import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { achievements, chores, rewards, users } from "../../db/schema";
import type { AchievementInput, ChoreInput, RewardInput } from "./schemas";

// Admin operations on the global catalog. Items are never deleted, only deactivated, so completions,
// redemptions and unlocked achievements keep pointing at real rows (and can be turned back on).
// Family-only rows (family_id set) are not managed here.

const globalChore = (id: string) => and(eq(chores.id, id), isNull(chores.familyId));
const globalReward = (id: string) => and(eq(rewards.id, id), isNull(rewards.familyId));

// ── Chores ───────────────────────────────────────────────────────────────────

export const listChores = (exec: Executor) =>
  exec.select().from(chores).where(isNull(chores.familyId)).orderBy(desc(chores.isActive), asc(chores.title));

export async function getChore(exec: Executor, id: string) {
  const [chore] = await exec.select().from(chores).where(globalChore(id));
  return chore ?? null;
}

export async function createChore(exec: Executor, input: ChoreInput) {
  const [chore] = await exec.insert(chores).values({ ...input, isGlobal: true }).returning({ id: chores.id });
  return chore.id;
}

/** False if there is no global chore with that id. */
export async function updateChore(exec: Executor, id: string, input: ChoreInput) {
  const updated = await exec.update(chores).set(input).where(globalChore(id)).returning({ id: chores.id });
  return updated.length > 0;
}

export async function setChoreActive(exec: Executor, id: string, isActive: boolean) {
  const updated = await exec.update(chores).set({ isActive }).where(globalChore(id)).returning({ id: chores.id });
  return updated.length > 0;
}

// ── Rewards ──────────────────────────────────────────────────────────────────

export const listRewards = (exec: Executor) =>
  exec.select().from(rewards).where(isNull(rewards.familyId)).orderBy(desc(rewards.isActive), asc(rewards.cost));

export async function getReward(exec: Executor, id: string) {
  const [reward] = await exec.select().from(rewards).where(globalReward(id));
  return reward ?? null;
}

export async function createReward(exec: Executor, input: RewardInput) {
  const [reward] = await exec.insert(rewards).values(input).returning({ id: rewards.id });
  return reward.id;
}

export async function updateReward(exec: Executor, id: string, input: RewardInput) {
  const updated = await exec.update(rewards).set(input).where(globalReward(id)).returning({ id: rewards.id });
  return updated.length > 0;
}

export async function setRewardActive(exec: Executor, id: string, isActive: boolean) {
  const updated = await exec.update(rewards).set({ isActive }).where(globalReward(id)).returning({ id: rewards.id });
  return updated.length > 0;
}

// ── Achievements ─────────────────────────────────────────────────────────────

export const listAchievements = (exec: Executor) =>
  exec
    .select()
    .from(achievements)
    .orderBy(desc(achievements.isActive), asc(achievements.ruleType), asc(achievements.threshold));

export async function getAchievement(exec: Executor, id: string) {
  const [achievement] = await exec.select().from(achievements).where(eq(achievements.id, id));
  return achievement ?? null;
}

export type SaveResult = { ok: true; id: string } | { ok: false; reason: "duplicate_code" | "not_found" };

export async function createAchievement(exec: Executor, input: AchievementInput): Promise<SaveResult> {
  const [created] = await exec.insert(achievements).values(input).onConflictDoNothing().returning({ id: achievements.id });
  return created ? { ok: true, id: created.id } : { ok: false, reason: "duplicate_code" };
}

export async function updateAchievement(exec: Executor, id: string, input: AchievementInput): Promise<SaveResult> {
  const [taken] = await exec
    .select({ id: achievements.id })
    .from(achievements)
    .where(and(eq(achievements.code, input.code), ne(achievements.id, id)));
  if (taken) return { ok: false, reason: "duplicate_code" };
  const updated = await exec.update(achievements).set(input).where(eq(achievements.id, id)).returning({ id: achievements.id });
  return updated.length > 0 ? { ok: true, id } : { ok: false, reason: "not_found" };
}

export async function setAchievementActive(exec: Executor, id: string, isActive: boolean) {
  const updated = await exec.update(achievements).set({ isActive }).where(eq(achievements.id, id)).returning({ id: achievements.id });
  return updated.length > 0;
}

// ── Users ────────────────────────────────────────────────────────────────────

export const listUsers = (exec: Executor) =>
  exec
    .select({
      id: users.id,
      provider: users.provider,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      // Correlated subqueries spelled out with table names: drizzle leaves columns unqualified here.
      balance: sql<number>`(select coalesce(sum(pl.delta), 0)::int from point_ledger pl where pl.user_id = users.id)`,
      lifetimeEarned: sql<number>`(select coalesce(sum(pl.delta), 0)::int from point_ledger pl where pl.user_id = users.id and pl.delta > 0)`,
      choresCompleted: sql<number>`(select count(*)::int from chore_completions cc where cc.user_id = users.id and cc.status = 'approved')`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

export type RoleChange = { ok: true } | { ok: false; reason: "not_found" | "cannot_demote_self" };

/** Changes a user's global role. An admin cannot remove their own admin role, so one admin always remains. */
export async function setUserRole(exec: Executor, actorId: string, targetId: string, role: "user" | "admin"): Promise<RoleChange> {
  if (targetId === actorId && role !== "admin") return { ok: false, reason: "cannot_demote_self" };
  const updated = await exec.update(users).set({ role }).where(eq(users.id, targetId)).returning({ id: users.id });
  return updated.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

/** The user's id and display name if they are currently an admin (checked on every admin request). */
export async function findAdmin(exec: Executor, userId: string) {
  const [user] = await exec
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "admin")));
  return user ?? null;
}
