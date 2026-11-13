import { and, asc, between, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import {
  achievements,
  choreCompletions,
  choreFamilySettings,
  chores,
  comboAwards,
  comboChores,
  combos,
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
import { type ProgressStats, alreadyCompletedCode, comboComplete, comboWindow, planUnlocks, streakDays } from "./rules";

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
  isFamilyItem: sql<boolean>`${achievements.familyId} is not null`,
};

/** Global achievements, plus the family's own for its members. */
const achievementsFor = (familyId: string | null) =>
  familyId ? or(isNull(achievements.familyId), eq(achievements.familyId, familyId)) : isNull(achievements.familyId);

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
  const familyId = (await membershipOf(tx, userId))?.familyId ?? null;
  const all = await tx
    .select(achievementColumns)
    .from(achievements)
    .where(and(eq(achievements.isActive, true), achievementsFor(familyId)));
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

/** Locks the user's row for the rest of the transaction; false if the user no longer exists or was deleted. */
async function lockUser(tx: Executor, userId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .for("update");
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
 * has not switched off, with its points override, plus the family's own active chores. Temporary chores
 * only until their deadline.
 */
function resolvedChores(exec: Executor, familyId: string | null, now: Date) {
  return exec
    .select({
      id: chores.id,
      title: chores.title,
      description: chores.description,
      icon: chores.icon,
      points: sql<number>`coalesce(${choreFamilySettings.pointsOverride}, ${chores.points})`.mapWith(Number),
      frequency: chores.frequency,
      // True for the family's own chores, false for global ones (also when the family changed their points).
      isFamilyItem: sql<boolean>`${chores.familyId} is not null`,
      // Null for regular chores; the deadline of a temporary one.
      expiresAt: chores.expiresAt,
    })
    .from(chores)
    .leftJoin(
      choreFamilySettings,
      and(eq(choreFamilySettings.choreId, chores.id), familyId ? eq(choreFamilySettings.familyId, familyId) : never),
    )
    .where(
      and(
        eq(chores.isActive, true),
        or(isNull(chores.expiresAt), gt(chores.expiresAt, now)),
        or(
          and(isNull(chores.familyId), sql`coalesce(${choreFamilySettings.isActive}, true)`),
          familyId ? eq(chores.familyId, familyId) : never,
        ),
      ),
    );
}

/**
 * Temporary chores that another member of the family already did (or is waiting for approval on): the
 * first one to do it takes it, so it is gone for everyone else. A rejected completion frees it again.
 */
async function takenByOthers(exec: Executor, familyId: string | null, userId: string, choreIds: string[]) {
  if (!familyId || choreIds.length === 0) return new Set<string>();
  const taken = await exec
    .selectDistinct({ choreId: choreCompletions.choreId })
    .from(choreCompletions)
    .innerJoin(familyMembers, eq(familyMembers.userId, choreCompletions.userId))
    .where(
      and(
        inArray(choreCompletions.choreId, choreIds),
        ne(choreCompletions.status, "rejected"),
        eq(familyMembers.familyId, familyId),
        ne(choreCompletions.userId, userId),
      ),
    );
  return new Set(taken.map((t) => t.choreId));
}

/**
 * Visible chores with whether the user already did each one in its current frequency window. Temporary
 * chores come first (soonest deadline first), minus those another family member already took.
 */
export async function listChores(exec: Executor, userId: string, now: Date) {
  const membership = await membershipOf(exec, userId);
  const familyId = membership?.familyId ?? null;
  const visible = await resolvedChores(exec, familyId, now).orderBy(
    sql`${chores.expiresAt} asc nulls last`,
    asc(chores.frequency),
    asc(chores.title),
  );
  const taken = await takenByOthers(exec, familyId, userId, visible.filter((c) => c.expiresAt).map((c) => c.id));
  const rows = visible.filter((c) => !taken.has(c.id));

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
    const familyId = membership?.familyId ?? null;
    const chore = (await resolvedChores(tx, familyId, now)).find((c) => c.id === choreId);
    if (!chore) {
      const [expired] = await tx
        .select({ id: chores.id })
        .from(chores)
        .where(and(eq(chores.id, choreId), eq(chores.isActive, true), lte(chores.expiresAt, now)));
      return expired ? fail(409, "chore_expired", "The deadline has passed") : fail(404, "chore_not_found", "No active chore with that id");
    }
    if (chore.expiresAt) {
      // Lock the chore so two members of a family cannot both take it at the same moment.
      await tx.select({ id: chores.id }).from(chores).where(eq(chores.id, choreId)).for("update");
      if ((await takenByOthers(tx, familyId, userId, [choreId])).size > 0)
        return fail(409, "chore_taken", "Someone else in the family already did it");
    }

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
    let comboBonuses: ComboBonus[] = [];
    if (!needsApproval) {
      await tx
        .insert(pointLedger)
        .values({ userId, delta: chore.points, reason: "chore_completed", refId: completion.id, createdAt: now });
      comboBonuses = await awardCombos(tx, userId, { choreId, localDate: completion.localDate }, now);
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
      comboBonuses,
    };
  });
}

/**
 * Books an approved completion's points (called by a parent's approval), then any combo it completes
 * (measured from the day the chore was done, not the day it was approved). Call inside a transaction.
 */
export async function bookApprovedCompletion(
  tx: Executor,
  completion: { id: string; userId: string; points: number; choreId: string; localDate: string },
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
  const comboBonuses = await awardCombos(tx, completion.userId, completion, now);
  return { unlockedAchievements: await unlockAchievements(tx, completion.userId, now), comboBonuses };
}

// ── Combos ───────────────────────────────────────────────────────────────────

export type ComboBonus = { comboId: string; title: string; icon: string; bonusPoints: number };

/**
 * Active combos for a family (or solo users): global ones plus the family's own, and only those whose
 * chores are all visible to it — a combo with a switched-off chore could never be completed.
 */
async function visibleCombos(exec: Executor, familyId: string | null, now: Date) {
  const visibleChores = new Map((await resolvedChores(exec, familyId, now)).map((c) => [c.id, c]));
  const rows = await exec
    .select({
      id: combos.id,
      title: combos.title,
      description: combos.description,
      icon: combos.icon,
      bonusPoints: combos.bonusPoints,
      period: combos.period,
      isFamilyItem: sql<boolean>`${combos.familyId} is not null`,
    })
    .from(combos)
    .where(and(eq(combos.isActive, true), familyId ? or(isNull(combos.familyId), eq(combos.familyId, familyId)) : isNull(combos.familyId)))
    .orderBy(asc(combos.period), asc(combos.title));
  if (rows.length === 0) return { combos: [], visibleChores };

  const links = await exec
    .select({ comboId: comboChores.comboId, choreId: comboChores.choreId })
    .from(comboChores)
    .where(inArray(comboChores.comboId, rows.map((r) => r.id)));
  const choreIds = Map.groupBy(links, (l) => l.comboId);
  const withChores = rows
    .map((combo) => ({ ...combo, choreIds: (choreIds.get(combo.id) ?? []).map((l) => l.choreId) }))
    .filter((combo) => combo.choreIds.length > 0 && combo.choreIds.every((id) => visibleChores.has(id)));
  return { combos: withChores, visibleChores };
}

/**
 * Pays the bonus of every combo the approved completion just finished: all the combo's chores approved
 * within its day or ISO week. Once per user, combo and period (unique index). Call inside a transaction,
 * after the completion's own points are booked.
 */
async function awardCombos(tx: Executor, userId: string, completion: { choreId: string; localDate: string }, now: Date) {
  const familyId = (await membershipOf(tx, userId))?.familyId ?? null;
  const candidates = (await visibleCombos(tx, familyId, now)).combos.filter((c) => c.choreIds.includes(completion.choreId));
  const awarded: ComboBonus[] = [];
  for (const combo of candidates) {
    const window = comboWindow(combo.period, completion.localDate);
    const done = await tx
      .selectDistinct({ choreId: choreCompletions.choreId })
      .from(choreCompletions)
      .where(
        and(
          eq(choreCompletions.userId, userId),
          eq(choreCompletions.status, "approved"),
          inArray(choreCompletions.choreId, combo.choreIds),
          between(choreCompletions.localDate, window.from, window.to),
        ),
      );
    if (!comboComplete(combo.choreIds, new Set(done.map((d) => d.choreId)))) continue;

    const [award] = await tx
      .insert(comboAwards)
      .values({ userId, comboId: combo.id, periodKey: window.key, bonusPoints: combo.bonusPoints, awardedAt: now })
      .onConflictDoNothing()
      .returning({ id: comboAwards.id });
    if (!award) continue;
    await tx
      .insert(pointLedger)
      .values({ userId, delta: combo.bonusPoints, reason: "combo_bonus", refId: award.id, createdAt: now });
    awarded.push({ comboId: combo.id, title: combo.title, icon: combo.icon, bonusPoints: combo.bonusPoints });
  }
  return awarded;
}

/**
 * The user's combos for the current day/week: each chore marked done (approved or waiting for approval)
 * in the combo's window, and whether the bonus was already paid this period.
 */
export async function listCombos(exec: Executor, userId: string, now: Date) {
  const familyId = (await membershipOf(exec, userId))?.familyId ?? null;
  const { combos: visible, visibleChores } = await visibleCombos(exec, familyId, now);
  if (visible.length === 0) return [];

  const today = stockholmDate(now);
  const week = comboWindow("week", today);
  const completions = await exec
    .select({ choreId: choreCompletions.choreId, localDate: choreCompletions.localDate, status: choreCompletions.status })
    .from(choreCompletions)
    .where(
      and(
        eq(choreCompletions.userId, userId),
        ne(choreCompletions.status, "rejected"),
        between(choreCompletions.localDate, week.from, week.to),
      ),
    );
  const awards = await exec
    .select({ comboId: comboAwards.comboId, periodKey: comboAwards.periodKey })
    .from(comboAwards)
    .where(and(eq(comboAwards.userId, userId), inArray(comboAwards.periodKey, [today, week.key])));
  const awarded = new Set(awards.map((a) => `${a.comboId}|${a.periodKey}`));

  return visible.map(({ choreIds, ...combo }) => {
    const window = comboWindow(combo.period, today);
    const inWindow = completions.filter((c) => c.localDate >= window.from && c.localDate <= window.to);
    return {
      ...combo,
      chores: choreIds
        .map((id) => {
          const chore = visibleChores.get(id)!;
          const statuses = inWindow.filter((c) => c.choreId === id).map((c) => c.status);
          return {
            choreId: id,
            title: chore.title,
            icon: chore.icon,
            done: statuses.length > 0,
            pending: statuses.length > 0 && !statuses.includes("approved"),
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title, "sv")),
      awardedThisPeriod: awarded.has(`${combo.id}|${window.key}`),
    };
  });
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
    .map(({ id, title, description, icon, cost, stock, isFamilyReward }) => ({ id, title, description, icon, cost, stock, isFamilyItem: isFamilyReward }))
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

/**
 * Active achievements the user can unlock (global, and their family's own) plus any they already unlocked
 * (even if inactive, or from a family they have left), with unlock time (null = locked).
 */
export async function listAchievements(exec: Executor, userId: string) {
  const familyId = (await membershipOf(exec, userId))?.familyId ?? null;
  return exec
    .select({ ...achievementColumns, unlockedAt: userAchievements.unlockedAt })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(eq(userAchievements.achievementId, achievements.id), eq(userAchievements.userId, userId)),
    )
    .where(or(and(eq(achievements.isActive, true), achievementsFor(familyId)), isNotNull(userAchievements.unlockedAt)))
    .orderBy(asc(RARITY_ORDER), asc(achievements.threshold), asc(achievements.title));
}

/** Dashboard numbers: balance, lifetime earned, streak, chores done this period, latest achievements, family name. */
export async function progressSummary(exec: Executor, userId: string, now: Date) {
  const stats = await loadStats(exec, userId, now);
  const [family] = await exec
    .select({ name: families.name })
    .from(familyMembers)
    .innerJoin(families, eq(families.id, familyMembers.familyId))
    .where(eq(familyMembers.userId, userId));
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
    familyName: family?.name ?? null,
  };
}
