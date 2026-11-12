import { and, asc, desc, eq, getTableColumns, isNull, ne, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { achievements, chores, families, rewards, users } from "../../db/schema";
import type { AchievementInput, ChoreInput, RewardInput } from "./schemas";

// Admin operations on the catalog: global items and family-only ones. Items are never deleted, only
// deactivated, so completions, redemptions and unlocked achievements keep pointing at real rows (and
// can be turned back on). The scope (global or one family) is chosen when an item is created and never
// changes afterwards.

/** Which items a list shows: everything, only the global catalog, or one family's own. */
export type ScopeFilter = "all" | "global" | { familyId: string };

/** null = global. */
export type Scope = string | null;

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "duplicate_code" | "family_not_found" | "global_stock" };

type ScopedTable = typeof chores | typeof rewards | typeof achievements;

function scopeWhere(table: ScopedTable, filter: ScopeFilter) {
  if (filter === "all") return undefined;
  return filter === "global" ? isNull(table.familyId) : eq(table.familyId, filter.familyId);
}

async function familyExists(exec: Executor, familyId: Scope) {
  if (familyId === null) return true;
  const [family] = await exec.select({ id: families.id }).from(families).where(eq(families.id, familyId));
  return Boolean(family);
}

const saved = (rows: { id: string }[]): SaveResult => (rows[0] ? { ok: true, id: rows[0].id } : { ok: false, reason: "not_found" });

// ── Chores ───────────────────────────────────────────────────────────────────

export const listChores = (exec: Executor, filter: ScopeFilter = "all") =>
  exec
    .select({ ...getTableColumns(chores), familyName: families.name })
    .from(chores)
    .leftJoin(families, eq(families.id, chores.familyId))
    .where(scopeWhere(chores, filter))
    .orderBy(desc(chores.isActive), asc(chores.title));

export async function getChore(exec: Executor, id: string) {
  const [chore] = await exec
    .select({ ...getTableColumns(chores), familyName: families.name })
    .from(chores)
    .leftJoin(families, eq(families.id, chores.familyId))
    .where(eq(chores.id, id));
  return chore ?? null;
}

export async function createChore(exec: Executor, input: ChoreInput, familyId: Scope): Promise<SaveResult> {
  if (!(await familyExists(exec, familyId))) return { ok: false, reason: "family_not_found" };
  return saved(await exec.insert(chores).values({ ...input, familyId, isGlobal: familyId === null }).returning({ id: chores.id }));
}

/** The scope stays as it was created. */
export async function updateChore(exec: Executor, id: string, input: ChoreInput): Promise<SaveResult> {
  return saved(await exec.update(chores).set(input).where(eq(chores.id, id)).returning({ id: chores.id }));
}

export async function setChoreActive(exec: Executor, id: string, isActive: boolean) {
  const updated = await exec.update(chores).set({ isActive }).where(eq(chores.id, id)).returning({ id: chores.id });
  return updated.length > 0;
}

// ── Rewards ──────────────────────────────────────────────────────────────────

export const listRewards = (exec: Executor, filter: ScopeFilter = "all") =>
  exec
    .select({ ...getTableColumns(rewards), familyName: families.name })
    .from(rewards)
    .leftJoin(families, eq(families.id, rewards.familyId))
    .where(scopeWhere(rewards, filter))
    .orderBy(desc(rewards.isActive), asc(rewards.cost));

export async function getReward(exec: Executor, id: string) {
  const [reward] = await exec
    .select({ ...getTableColumns(rewards), familyName: families.name })
    .from(rewards)
    .leftJoin(families, eq(families.id, rewards.familyId))
    .where(eq(rewards.id, id));
  return reward ?? null;
}

// Global rewards are unlimited (stock is counted per family); only family rewards carry a stock.
export async function createReward(exec: Executor, input: RewardInput, familyId: Scope): Promise<SaveResult> {
  if (familyId === null && input.stock !== null) return { ok: false, reason: "global_stock" };
  if (!(await familyExists(exec, familyId))) return { ok: false, reason: "family_not_found" };
  return saved(await exec.insert(rewards).values({ ...input, familyId }).returning({ id: rewards.id }));
}

/** The scope stays as it was created. Setting a family reward's stock is an explicit restock. */
export async function updateReward(exec: Executor, id: string, input: RewardInput): Promise<SaveResult> {
  const [reward] = await exec.select({ familyId: rewards.familyId }).from(rewards).where(eq(rewards.id, id));
  if (!reward) return { ok: false, reason: "not_found" };
  if (reward.familyId === null && input.stock !== null) return { ok: false, reason: "global_stock" };
  return saved(await exec.update(rewards).set(input).where(eq(rewards.id, id)).returning({ id: rewards.id }));
}

export async function setRewardActive(exec: Executor, id: string, isActive: boolean) {
  const updated = await exec.update(rewards).set({ isActive }).where(eq(rewards.id, id)).returning({ id: rewards.id });
  return updated.length > 0;
}

// ── Achievements ─────────────────────────────────────────────────────────────

export const listAchievements = (exec: Executor, filter: ScopeFilter = "all") =>
  exec
    .select({ ...getTableColumns(achievements), familyName: families.name })
    .from(achievements)
    .leftJoin(families, eq(families.id, achievements.familyId))
    .where(scopeWhere(achievements, filter))
    .orderBy(desc(achievements.isActive), asc(achievements.ruleType), asc(achievements.threshold));

export async function getAchievement(exec: Executor, id: string) {
  const [achievement] = await exec
    .select({ ...getTableColumns(achievements), familyName: families.name })
    .from(achievements)
    .leftJoin(families, eq(families.id, achievements.familyId))
    .where(eq(achievements.id, id));
  return achievement ?? null;
}

export async function createAchievement(exec: Executor, input: AchievementInput, familyId: Scope): Promise<SaveResult> {
  if (!(await familyExists(exec, familyId))) return { ok: false, reason: "family_not_found" };
  const [created] = await exec
    .insert(achievements)
    .values({ ...input, familyId })
    .onConflictDoNothing()
    .returning({ id: achievements.id });
  return created ? { ok: true, id: created.id } : { ok: false, reason: "duplicate_code" };
}

/** The scope stays as it was created. Codes are unique across all achievements, global and family. */
export async function updateAchievement(exec: Executor, id: string, input: AchievementInput): Promise<SaveResult> {
  const [taken] = await exec
    .select({ id: achievements.id })
    .from(achievements)
    .where(and(eq(achievements.code, input.code), ne(achievements.id, id)));
  if (taken) return { ok: false, reason: "duplicate_code" };
  return saved(await exec.update(achievements).set(input).where(eq(achievements.id, id)).returning({ id: achievements.id }));
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
      deletedAt: users.deletedAt,
      familyId: sql<string | null>`(select fm.family_id from family_members fm where fm.user_id = users.id)`,
      familyName: sql<string | null>`(select f.name from family_members fm join families f on f.id = fm.family_id where fm.user_id = users.id)`,
      familyRole: sql<"parent" | "child" | null>`(select fm.role from family_members fm where fm.user_id = users.id)`,
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
    .where(and(eq(users.id, userId), eq(users.role, "admin"), isNull(users.deletedAt)));
  return user ?? null;
}
