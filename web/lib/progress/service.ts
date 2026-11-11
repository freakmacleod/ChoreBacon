import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import {
  achievements,
  choreCompletions,
  choreFamilySettings,
  chores,
  families,
  familyMembers,
  pointLedger,
  redemptions,
  rewardFamilySettings,
  rewards,
  userAchievements,
  users,
} from "../../db/schema";
import { type Frequency, periodKey, stockholmDate } from "../stockholm-time";
import { type ProgressStats, alreadyCompletedCode, planUnlocks, streakDays } from "./rules";

// The API is the source of truth for points, completions, redemptions and achievements. Every write
// runs in one transaction that first locks the user's row, so a user's balance and achievement checks
// are serialised (two quick taps cannot both spend the same points).
//
// Family members see their family's view of the catalog (overrides, switched-off items, family-only
// items); solo users see the active global catalog. Children's completions wait for approval when
// their family requires it.

export type Failure = { ok: false; status: 404 | 409; code: string; message: string };
const fail = (status: 404 | 409, code: string, message: string): Failure => ({ ok: false, status, code, message });

const RARITY_ORDER = sql`array_position(array['common','uncommon','rare','epic','legendary']::achievement_rarity[], ${achievements.rarity})`;

const achievementColumns = {
  id: achievements.id,
  code: achievements.code,
  title: achievements.title,
  description: achievements.description,
  icon: achievements.icon,
  ruleType: achievements.ruleType,
  threshold: achievements.threshold,
  bonusPoints: achievements.bonusPoints,
  rarity: achievements.rarity,
};

export type UnlockedAchievement = Awaited<ReturnType<typeof unlockAchievements>>[number];

// ── Stats ────────────────────────────────────────────────────────────────────

export async function loadStats(exec: Executor, userId: string, now: Date): Promise<ProgressStats> {
  const [points] = await exec
    .select({
      balance: sql<number>`coalesce(sum(${pointLedger.delta}), 0)::int`,
      lifetimeEarned: sql<number>`coalesce(sum(${pointLedger.delta}) filter (where ${pointLedger.delta} > 0), 0)::int`,
      pointsSpent: sql<number>`coalesce(-sum(${pointLedger.delta}) filter (where ${pointLedger.reason} = 'reward_redeemed'), 0)::int`,
    })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));

  const approved = and(eq(choreCompletions.userId, userId), eq(choreCompletions.status, "approved"));
  const [{ count }] = await exec.select({ count: sql<number>`count(*)::int` }).from(choreCompletions).where(approved);
  const dates = await exec.selectDistinct({ localDate: choreCompletions.localDate }).from(choreCompletions).where(approved);

  return {
    ...points,
    choresCompleted: count,
    streakDays: streakDays(
      dates.map((d) => d.localDate),
      stockholmDate(now),
    ),
  };
}

/** Unlocks every achievement the user now qualifies for and books their bonus points. Call inside a transaction. */
async function unlockAchievements(tx: Executor, userId: string, now: Date) {
  const all = await tx.select(achievementColumns).from(achievements).where(eq(achievements.isActive, true));
  const owned = await tx
    .select({ id: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const unlocked = planUnlocks(all, await loadStats(tx, userId, now), new Set(owned.map((o) => o.id)));
  for (const achievement of unlocked) {
    await tx.insert(userAchievements).values({ userId, achievementId: achievement.id, unlockedAt: now });
    if (achievement.bonusPoints > 0)
      await tx.insert(pointLedger).values({
        userId,
        delta: achievement.bonusPoints,
        reason: "achievement_bonus",
        refId: achievement.id,
        createdAt: now,
      });
  }
  return unlocked.map((a) => ({ ...a, unlockedAt: now }));
}

/** Locks the user's row for the rest of the transaction; false if the user no longer exists. */
async function lockUser(tx: Executor, userId: string): Promise<boolean> {
  const rows = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
  return rows.length > 0;
}

const USER_GONE = fail(404, "user_not_found", "User no longer exists");

// ── Family context ───────────────────────────────────────────────────────────

export type Membership = { familyId: string; role: "parent" | "child"; requiresApproval: boolean };

/** The user's family (one per user) or null for solo users, who see the plain global catalog. */
export async function membershipOf(exec: Executor, userId: string): Promise<Membership | null> {
  const [row] = await exec
    .select({ familyId: familyMembers.familyId, role: familyMembers.role, requiresApproval: families.requiresApproval })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(eq(familyMembers.userId, userId));
  return row ?? null;
}

const never = sql`false`;

// ── Chores ───────────────────────────────────────────────────────────────────

/**
 * Chores visible to a family (or to solo users when familyId is null): active global chores the family
 * has not switched off, with its points override, plus the family's own active chores.
 */
function resolvedChores(exec: Executor, familyId: string | null) {
  return exec
    .select({
      id: chores.id,
      title: chores.title,
      description: chores.description,
      icon: chores.icon,
      points: sql<number>`coalesce(${choreFamilySettings.pointsOverride}, ${chores.points})`.mapWith(Number),
      frequency: chores.frequency,
    })
    .from(chores)
    .leftJoin(
      choreFamilySettings,
      and(eq(choreFamilySettings.choreId, chores.id), familyId ? eq(choreFamilySettings.familyId, familyId) : never),
    )
    .where(
      and(
        eq(chores.isActive, true),
        or(
          and(isNull(chores.familyId), sql`coalesce(${choreFamilySettings.isActive}, true)`),
          familyId ? eq(chores.familyId, familyId) : never,
        ),
      ),
    );
}

/** Visible chores with whether the user already did each one in its current frequency window. */
export async function listChores(exec: Executor, userId: string, now: Date) {
  const membership = await membershipOf(exec, userId);
  const rows = await resolvedChores(exec, membership?.familyId ?? null).orderBy(asc(chores.frequency), asc(chores.title));

  const keys = [...new Set((["daily", "weekly", "monthly", "once"] as const).map((f) => periodKey(f, now)))];
  const done = await exec
    .select({ choreId: choreCompletions.choreId, periodKey: choreCompletions.periodKey, status: choreCompletions.status })
    .from(choreCompletions)
    .where(
      and(
        eq(choreCompletions.userId, userId),
        inArray(choreCompletions.periodKey, keys),
        ne(choreCompletions.status, "rejected"),
      ),
    );
  const doneKey = new Map(done.map((d) => [`${d.choreId}|${d.periodKey}`, d.status]));

  return rows.map((chore) => {
    const status = doneKey.get(`${chore.id}|${periodKey(chore.frequency, now)}`);
    return { ...chore, completedThisPeriod: status !== undefined, completionStatus: status ?? null };
  });
}

/**
 * Completes a chore once per frequency window (business rule 2). Points are booked now, or — for a
 * child in a family that requires approval — when a parent approves the completion.
 */
export async function completeChore(exec: Executor, userId: string, choreId: string, now: Date) {
  return exec.transaction(async (tx) => {
    if (!(await lockUser(tx, userId))) return USER_GONE;
    const membership = await membershipOf(tx, userId);

    // The visible catalog is small (tens of rows), so resolve it and pick the chore.
    const chore = (await resolvedChores(tx, membership?.familyId ?? null)).find((c) => c.id === choreId);
    if (!chore) return fail(404, "chore_not_found", "No active chore with that id");

    const needsApproval = membership?.role === "child" && membership.requiresApproval;
    const window = periodKey(chore.frequency, now);
    // The partial unique index (user, chore, period_key) WHERE status <> 'rejected' is the real guard.
    const [completion] = await tx
      .insert(choreCompletions)
      .values({
        userId,
        choreId,
        completedAt: now,
        localDate: stockholmDate(now),
        periodKey: window,
        points: chore.points,
        status: needsApproval ? "pending" : "approved",
      })
      .onConflictDoNothing()
      .returning({
        id: choreCompletions.id,
        choreId: choreCompletions.choreId,
        localDate: choreCompletions.localDate,
        periodKey: choreCompletions.periodKey,
        status: choreCompletions.status,
        completedAt: choreCompletions.completedAt,
      });
    if (!completion) return fail(409, alreadyCompletedCode(chore.frequency as Frequency), "Already completed in this period");

    let unlocked: UnlockedAchievement[] = [];
    if (!needsApproval) {
      await tx
        .insert(pointLedger)
        .values({ userId, delta: chore.points, reason: "chore_completed", refId: completion.id, createdAt: now });
      unlocked = await unlockAchievements(tx, userId, now);
    }
    const { balance } = await loadStats(tx, userId, now);

    return {
      ok: true as const,
      completion,
      pointsEarned: needsApproval ? 0 : chore.points,
      pointsPending: needsApproval ? chore.points : 0,
      balance,
      unlockedAchievements: unlocked,
    };
  });
}

/** Books an approved completion's points (called by a parent's approval). Call inside a transaction. */
export async function bookApprovedCompletion(
  tx: Executor,
  completion: { id: string; userId: string; points: number },
  now: Date,
) {
  await lockUser(tx, completion.userId);
  await tx.insert(pointLedger).values({
    userId: completion.userId,
    delta: completion.points,
    reason: "chore_completed",
    refId: completion.id,
    createdAt: now,
  });
  return unlockAchievements(tx, completion.userId, now);
}

// ── Rewards ──────────────────────────────────────────────────────────────────

/**
 * Rewards visible to a family (or solo users): active global rewards the family has not switched off,
 * with its cost override and its own stock (global rewards are unlimited unless the family sets stock),
 * plus the family's own active rewards with their stock.
 */
function resolvedRewards(exec: Executor, familyId: string | null) {
  return exec
    .select({
      id: rewards.id,
      title: rewards.title,
      description: rewards.description,
      icon: rewards.icon,
      cost: sql<number>`coalesce(${rewardFamilySettings.costOverride}, ${rewards.cost})`.mapWith(Number),
      stock: sql<number | null>`case when ${rewards.familyId} is null then ${rewardFamilySettings.stock} else ${rewards.stock} end`,
      isFamilyReward: sql<boolean>`${rewards.familyId} is not null`,
    })
    .from(rewards)
    .leftJoin(
      rewardFamilySettings,
      and(eq(rewardFamilySettings.rewardId, rewards.id), familyId ? eq(rewardFamilySettings.familyId, familyId) : never),
    )
    .where(
      and(
        eq(rewards.isActive, true),
        or(
          and(isNull(rewards.familyId), sql`coalesce(${rewardFamilySettings.isActive}, true)`),
          familyId ? eq(rewards.familyId, familyId) : never,
        ),
      ),
    );
}

export async function listRewards(exec: Executor, userId: string) {
  const membership = await membershipOf(exec, userId);
  const rows = await resolvedRewards(exec, membership?.familyId ?? null);
  return rows
    .map(({ id, title, description, icon, cost, stock }) => ({ id, title, description, icon, cost, stock }))
    .sort((a, b) => a.cost - b.cost || a.title.localeCompare(b.title, "sv"));
}

/**
 * Atomic redemption (business rule 4): in one transaction check the balance, take one from the
 * family's stock (`stock - 1 WHERE stock > 0`), then write the redemption and the ledger entry. Sold
 * out stays sold out — nothing ever restocks automatically (business rule 5).
 */
export async function redeemReward(exec: Executor, userId: string, rewardId: string, now: Date) {
  return exec.transaction(async (tx) => {
    if (!(await lockUser(tx, userId))) return USER_GONE;
    const familyId = (await membershipOf(tx, userId))?.familyId ?? null;

    const reward = (await resolvedRewards(tx, familyId)).find((r) => r.id === rewardId);
    if (!reward) return fail(404, "reward_not_found", "No active reward with that id");
    if (reward.stock === 0) return fail(409, "reward_out_of_stock", "Sold out");

    const { balance } = await loadStats(tx, userId, now);
    if (balance < reward.cost) return fail(409, "insufficient_points", `Needs ${reward.cost} points, balance is ${balance}`);

    if (reward.stock !== null) {
      // Someone else may have taken the last one since we read it; the WHERE makes this the real check.
      const taken = reward.isFamilyReward
        ? await tx
            .update(rewards)
            .set({ stock: sql`${rewards.stock} - 1` })
            .where(and(eq(rewards.id, rewardId), sql`${rewards.stock} > 0`))
            .returning({ id: rewards.id })
        : await tx
            .update(rewardFamilySettings)
            .set({ stock: sql`${rewardFamilySettings.stock} - 1` })
            .where(
              and(
                eq(rewardFamilySettings.rewardId, rewardId),
                eq(rewardFamilySettings.familyId, familyId!),
                sql`${rewardFamilySettings.stock} > 0`,
              ),
            )
            .returning({ id: rewardFamilySettings.rewardId });
      if (taken.length === 0) return fail(409, "reward_out_of_stock", "Sold out");
    }

    const [redemption] = await tx
      .insert(redemptions)
      .values({ userId, rewardId, cost: reward.cost, status: "pending", createdAt: now })
      .returning({
        id: redemptions.id,
        rewardId: redemptions.rewardId,
        cost: redemptions.cost,
        status: redemptions.status,
        createdAt: redemptions.createdAt,
      });
    await tx
      .insert(pointLedger)
      .values({ userId, delta: -reward.cost, reason: "reward_redeemed", refId: redemption.id, createdAt: now });
    const unlocked = await unlockAchievements(tx, userId, now);

    return {
      ok: true as const,
      redemption,
      balance: (await loadStats(tx, userId, now)).balance,
      unlockedAchievements: unlocked,
    };
  });
}

// ── Achievements and summary ─────────────────────────────────────────────────

/** Active achievements plus any inactive ones the user already unlocked, with unlock time (null = locked). */
export function listAchievements(exec: Executor, userId: string) {
  return exec
    .select({ ...achievementColumns, unlockedAt: userAchievements.unlockedAt })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(eq(userAchievements.achievementId, achievements.id), eq(userAchievements.userId, userId)),
    )
    .where(or(eq(achievements.isActive, true), isNotNull(userAchievements.unlockedAt)))
    .orderBy(asc(RARITY_ORDER), asc(achievements.threshold), asc(achievements.title));
}

/** Dashboard numbers: balance, lifetime earned, streak, chores done this period, latest achievements. */
export async function progressSummary(exec: Executor, userId: string, now: Date) {
  const stats = await loadStats(exec, userId, now);
  const choreList = await listChores(exec, userId, now);
  const recentAchievements = await exec
    .select({ ...achievementColumns, unlockedAt: userAchievements.unlockedAt })
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt))
    .limit(3);

  return {
    ...stats,
    choresDoneThisPeriod: choreList.filter((c) => c.completedThisPeriod).length,
    choresTotal: choreList.length,
    recentAchievements,
  };
}
