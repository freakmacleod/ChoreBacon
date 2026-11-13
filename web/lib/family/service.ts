import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import {
  choreCompletions,
  choreFamilySettings,
  chores,
  families,
  familyMembers,
  redemptions,
  rewardFamilySettings,
  rewards,
  users,
} from "../../db/schema";
import { type Membership, bookApprovedCompletion, membershipOf } from "../progress/service";
import { formatInviteCode, newInviteCode, normalizeInviteCode } from "./invite-code";
import type { ChoreSettings, FamilyChore, FamilyReward, RewardSettings } from "./schemas";

// Families: one per user. Whoever creates a family is its first parent; everyone joining with the
// invite code joins as a child, and a parent can promote them. Parents approve completions (when the
// family requires it), mark redemptions as handed over, and tailor the catalog for their family.

export type Failure = { ok: false; status: 403 | 404 | 409; code: string; message: string };
const fail = (status: Failure["status"], code: string, message: string): Failure => ({ ok: false, status, code, message });

const NO_FAMILY = fail(404, "no_family", "Not a member of a family");
const NOT_PARENT = fail(403, "not_parent", "Only parents can do this");

/** The caller's membership if they are a parent; otherwise the failure to return. */
async function asParent(exec: Executor, userId: string): Promise<Membership | Failure> {
  const membership = await membershipOf(exec, userId);
  if (!membership) return NO_FAMILY;
  return membership.role === "parent" ? membership : NOT_PARENT;
}
const isFailure = (value: object): value is Failure => "ok" in value && value.ok === false;

// ── Membership ───────────────────────────────────────────────────────────────

export async function createFamily(exec: Executor, userId: string, name: string) {
  return exec.transaction(async (tx) => {
    if (await membershipOf(tx, userId)) return fail(409, "already_in_family", "Already a member of a family");
    const [family] = await tx
      .insert(families)
      .values({ name, inviteCode: await unusedInviteCode(tx) })
      .returning({ id: families.id });
    await tx.insert(familyMembers).values({ familyId: family.id, userId, role: "parent" });
    return { ok: true as const, familyId: family.id };
  });
}

export async function joinFamily(exec: Executor, userId: string, code: string) {
  const inviteCode = normalizeInviteCode(code);
  if (!inviteCode) return fail(404, "invalid_invite_code", "No family with that code");
  return exec.transaction(async (tx) => {
    const [family] = await tx.select({ id: families.id }).from(families).where(eq(families.inviteCode, inviteCode));
    if (!family) return fail(404, "invalid_invite_code", "No family with that code");
    // The unique index on family_members.user_id is the real "one family" guard.
    const [joined] = await tx
      .insert(familyMembers)
      .values({ familyId: family.id, userId, role: "child" })
      .onConflictDoNothing()
      .returning({ userId: familyMembers.userId });
    return joined ? { ok: true as const, familyId: family.id } : fail(409, "already_in_family", "Already a member of a family");
  });
}

/** Leaves the family. The last parent cannot leave while others remain (someone must be able to approve). */
export async function leaveFamily(exec: Executor, userId: string) {
  return exec.transaction(async (tx) => {
    const membership = await membershipOf(tx, userId);
    if (!membership) return NO_FAMILY;
    // Lock the family's member rows so two parents cannot both leave at once.
    const members = await tx
      .select({ userId: familyMembers.userId, role: familyMembers.role })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, membership.familyId))
      .for("update");
    const others = members.filter((m) => m.userId !== userId);
    if (membership.role === "parent" && others.length > 0 && !others.some((m) => m.role === "parent"))
      return fail(409, "last_parent", "Make someone else a parent before leaving");
    await tx.delete(familyMembers).where(eq(familyMembers.userId, userId));
    return { ok: true as const };
  });
}

/** The caller's family with members and their balances; the invite code is only shown to parents. */
export async function getFamily(exec: Executor, userId: string) {
  const membership = await membershipOf(exec, userId);
  if (!membership) return NO_FAMILY;
  const [family] = await exec.select().from(families).where(eq(families.id, membership.familyId));
  const members = await exec
    .select({
      userId: users.id,
      displayName: users.displayName,
      role: familyMembers.role,
      balance: sql<number>`(select coalesce(sum(pl.delta), 0)::int from point_ledger pl where pl.user_id = users.id)`,
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, membership.familyId))
    .orderBy(asc(familyMembers.role), asc(users.displayName));
  return {
    ok: true as const,
    family: {
      id: family.id,
      name: family.name,
      requiresApproval: family.requiresApproval,
      inviteCode: membership.role === "parent" ? formatInviteCode(family.inviteCode) : null,
      role: membership.role,
      members,
    },
  };
}

export async function updateFamily(exec: Executor, userId: string, changes: { name?: string; requiresApproval?: boolean }) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  await exec.update(families).set(changes).where(eq(families.id, parent.familyId));
  return { ok: true as const };
}

/** A new code; the old one stops working (e.g. after it was shared too widely). */
export async function regenerateInviteCode(exec: Executor, userId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const code = await unusedInviteCode(exec);
  await exec.update(families).set({ inviteCode: code }).where(eq(families.id, parent.familyId));
  return { ok: true as const, inviteCode: formatInviteCode(code) };
}

/** A code no family uses yet (the unique constraint stays the final guard against a race). */
export async function unusedInviteCode(exec: Executor) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const [taken] = await exec.select({ id: families.id }).from(families).where(eq(families.inviteCode, code));
    if (!taken) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

async function memberOfSameFamily(exec: Executor, familyId: string, memberId: string) {
  const [member] = await exec
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, memberId)));
  return member ?? null;
}

export async function setMemberRole(exec: Executor, userId: string, memberId: string, role: "parent" | "child") {
  return exec.transaction(async (tx) => {
    const parent = await asParent(tx, userId);
    if (isFailure(parent)) return parent;
    if (!(await memberOfSameFamily(tx, parent.familyId, memberId))) return fail(404, "member_not_found", "No such family member");
    if (role === "child") {
      const parents = await tx
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, parent.familyId), eq(familyMembers.role, "parent")))
        .for("update");
      if (parents.every((p) => p.userId === memberId)) return fail(409, "last_parent", "A family needs at least one parent");
    }
    await tx.update(familyMembers).set({ role }).where(eq(familyMembers.userId, memberId));
    return { ok: true as const };
  });
}

/** Removes another member (a member leaves themselves with leaveFamily). Their points stay theirs. */
export async function removeMember(exec: Executor, userId: string, memberId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  if (memberId === userId) return fail(409, "use_leave", "Use leave to leave the family yourself");
  const removed = await exec
    .delete(familyMembers)
    .where(and(eq(familyMembers.familyId, parent.familyId), eq(familyMembers.userId, memberId)))
    .returning({ userId: familyMembers.userId });
  return removed.length > 0 ? { ok: true as const } : fail(404, "member_not_found", "No such family member");
}

// ── Approvals and hand-over ──────────────────────────────────────────────────

const familyMember = (familyId: string, userColumn: typeof choreCompletions.userId | typeof redemptions.userId) =>
  sql`exists (select 1 from family_members fm where fm.user_id = ${userColumn} and fm.family_id = ${familyId})`;

/** Completions in the family waiting for a parent. */
export async function pendingCompletions(exec: Executor, userId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const items = await exec
    .select({
      id: choreCompletions.id,
      userId: choreCompletions.userId,
      displayName: users.displayName,
      choreId: choreCompletions.choreId,
      choreTitle: chores.title,
      points: sql<number>`coalesce(${choreCompletions.points}, ${chores.points})`.mapWith(Number),
      localDate: choreCompletions.localDate,
      completedAt: choreCompletions.completedAt,
    })
    .from(choreCompletions)
    .innerJoin(users, eq(users.id, choreCompletions.userId))
    .innerJoin(chores, eq(chores.id, choreCompletions.choreId))
    .where(and(eq(choreCompletions.status, "pending"), familyMember(parent.familyId, choreCompletions.userId)))
    .orderBy(asc(choreCompletions.completedAt));
  return { ok: true as const, items };
}

/**
 * Approves (books the points, unlocks achievements) or rejects (frees the slot so the chore can be done
 * again in the same window) a pending completion of someone in the parent's family.
 */
export async function reviewCompletion(exec: Executor, userId: string, completionId: string, approve: boolean, now: Date) {
  return exec.transaction(async (tx) => {
    const parent = await asParent(tx, userId);
    if (isFailure(parent)) return parent;
    const [completion] = await tx
      .select({
        id: choreCompletions.id,
        userId: choreCompletions.userId,
        status: choreCompletions.status,
        points: sql<number>`coalesce(${choreCompletions.points}, ${chores.points})`.mapWith(Number),
        choreId: choreCompletions.choreId,
        localDate: choreCompletions.localDate,
      })
      .from(choreCompletions)
      .innerJoin(chores, eq(chores.id, choreCompletions.choreId))
      .where(and(eq(choreCompletions.id, completionId), familyMember(parent.familyId, choreCompletions.userId)))
      .for("update", { of: choreCompletions });
    if (!completion) return fail(404, "completion_not_found", "No such completion in your family");
    if (completion.status !== "pending") return fail(409, "not_pending", "Already reviewed");

    await tx
      .update(choreCompletions)
      .set({ status: approve ? "approved" : "rejected" })
      .where(eq(choreCompletions.id, completionId));
    const booked = approve ? await bookApprovedCompletion(tx, completion, now) : { unlockedAchievements: [], comboBonuses: [] };
    return { ok: true as const, status: approve ? ("approved" as const) : ("rejected" as const), ...booked };
  });
}

/** Redemptions in the family that a parent still has to hand over. */
export async function pendingRedemptions(exec: Executor, userId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const items = await exec
    .select({
      id: redemptions.id,
      userId: redemptions.userId,
      displayName: users.displayName,
      rewardId: redemptions.rewardId,
      rewardTitle: rewards.title,
      cost: redemptions.cost,
      createdAt: redemptions.createdAt,
    })
    .from(redemptions)
    .innerJoin(users, eq(users.id, redemptions.userId))
    .innerJoin(rewards, eq(rewards.id, redemptions.rewardId))
    .where(and(eq(redemptions.status, "pending"), familyMember(parent.familyId, redemptions.userId)))
    .orderBy(asc(redemptions.createdAt));
  return { ok: true as const, items };
}

export async function fulfilRedemption(exec: Executor, userId: string, redemptionId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const updated = await exec
    .update(redemptions)
    .set({ status: "fulfilled" })
    .where(
      and(eq(redemptions.id, redemptionId), eq(redemptions.status, "pending"), familyMember(parent.familyId, redemptions.userId)),
    )
    .returning({ id: redemptions.id });
  return updated.length > 0 ? { ok: true as const } : fail(404, "redemption_not_found", "No pending redemption with that id in your family");
}

// ── The family's catalog ─────────────────────────────────────────────────────

/** Parent view: active global chores with this family's settings, plus the family's own chores (also inactive). */
export async function familyChores(exec: Executor, userId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const items = await exec
    .select({
      id: chores.id,
      title: chores.title,
      description: chores.description,
      icon: chores.icon,
      points: chores.points,
      frequency: chores.frequency,
      isFamilyChore: sql<boolean>`${chores.familyId} is not null`,
      isActive: sql<boolean>`case when ${chores.familyId} is null then coalesce(${choreFamilySettings.isActive}, true) else ${chores.isActive} end`,
      pointsOverride: choreFamilySettings.pointsOverride,
    })
    .from(chores)
    .leftJoin(choreFamilySettings, and(eq(choreFamilySettings.choreId, chores.id), eq(choreFamilySettings.familyId, parent.familyId)))
    .where(sql`(${chores.familyId} is null and ${chores.isActive}) or ${chores.familyId} = ${parent.familyId}`)
    .orderBy(desc(sql`${chores.familyId} is not null`), asc(chores.title));
  return { ok: true as const, items };
}

export async function setChoreSettings(exec: Executor, userId: string, choreId: string, settings: ChoreSettings) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const [chore] = await exec
    .select({ id: chores.id })
    .from(chores)
    .where(and(eq(chores.id, choreId), isNull(chores.familyId), eq(chores.isActive, true)));
  if (!chore) return fail(404, "chore_not_found", "No active global chore with that id");
  await exec
    .insert(choreFamilySettings)
    .values({ familyId: parent.familyId, choreId, ...settings })
    .onConflictDoUpdate({ target: [choreFamilySettings.familyId, choreFamilySettings.choreId], set: settings });
  return { ok: true as const };
}

export async function createFamilyChore(exec: Executor, userId: string, input: FamilyChore) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const [chore] = await exec
    .insert(chores)
    .values({ ...input, isGlobal: false, familyId: parent.familyId })
    .returning({ id: chores.id });
  return { ok: true as const, id: chore.id };
}

export async function updateFamilyChore(exec: Executor, userId: string, choreId: string, input: FamilyChore) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const updated = await exec
    .update(chores)
    // A temporary chore (set up in the admin) stays a one-off whatever frequency the app sends.
    .set({ ...input, frequency: sql`case when ${chores.expiresAt} is null then ${input.frequency}::chore_frequency else 'once' end` })
    .where(and(eq(chores.id, choreId), eq(chores.familyId, parent.familyId)))
    .returning({ id: chores.id });
  return updated.length > 0 ? { ok: true as const, id: choreId } : fail(404, "chore_not_found", "No family chore with that id");
}

/** Parent view: active global rewards with this family's settings and stock, plus the family's own rewards. */
export async function familyRewards(exec: Executor, userId: string) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const items = await exec
    .select({
      id: rewards.id,
      title: rewards.title,
      description: rewards.description,
      icon: rewards.icon,
      cost: rewards.cost,
      isFamilyReward: sql<boolean>`${rewards.familyId} is not null`,
      isActive: sql<boolean>`case when ${rewards.familyId} is null then coalesce(${rewardFamilySettings.isActive}, true) else ${rewards.isActive} end`,
      costOverride: rewardFamilySettings.costOverride,
      stock: sql<number | null>`case when ${rewards.familyId} is null then ${rewardFamilySettings.stock} else ${rewards.stock} end`,
    })
    .from(rewards)
    .leftJoin(rewardFamilySettings, and(eq(rewardFamilySettings.rewardId, rewards.id), eq(rewardFamilySettings.familyId, parent.familyId)))
    .where(sql`(${rewards.familyId} is null and ${rewards.isActive}) or ${rewards.familyId} = ${parent.familyId}`)
    .orderBy(desc(sql`${rewards.familyId} is not null`), asc(rewards.cost));
  return { ok: true as const, items };
}

/** Setting stock is an explicit restock by a parent; nothing restocks automatically (business rule 5). */
export async function setRewardSettings(exec: Executor, userId: string, rewardId: string, settings: RewardSettings) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const [reward] = await exec
    .select({ id: rewards.id })
    .from(rewards)
    .where(and(eq(rewards.id, rewardId), isNull(rewards.familyId), eq(rewards.isActive, true)));
  if (!reward) return fail(404, "reward_not_found", "No active global reward with that id");
  await exec
    .insert(rewardFamilySettings)
    .values({ familyId: parent.familyId, rewardId, ...settings })
    .onConflictDoUpdate({ target: [rewardFamilySettings.familyId, rewardFamilySettings.rewardId], set: settings });
  return { ok: true as const };
}

export async function createFamilyReward(exec: Executor, userId: string, input: FamilyReward) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const [reward] = await exec.insert(rewards).values({ ...input, familyId: parent.familyId }).returning({ id: rewards.id });
  return { ok: true as const, id: reward.id };
}

export async function updateFamilyReward(exec: Executor, userId: string, rewardId: string, input: FamilyReward) {
  const parent = await asParent(exec, userId);
  if (isFailure(parent)) return parent;
  const updated = await exec
    .update(rewards)
    .set(input)
    .where(and(eq(rewards.id, rewardId), eq(rewards.familyId, parent.familyId)))
    .returning({ id: rewards.id });
  return updated.length > 0 ? { ok: true as const, id: rewardId } : fail(404, "reward_not_found", "No family reward with that id");
}

