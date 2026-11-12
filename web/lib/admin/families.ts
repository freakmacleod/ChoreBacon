import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { choreFamilySettings, chores, families, familyMembers, rewardFamilySettings, rewards, users } from "../../db/schema";
import { formatInviteCode } from "../family/invite-code";
import { unusedInviteCode } from "../family/service";

// Admin view of families: who is in which family, and what each family has changed or added on top of
// the global catalog. The admin can also create families and place users in them (e.g. to set up a
// parent without the app); the catalog itself is still tailored by the parents in the app. The same
// rules as in the app hold: one family per user, and a family with members always keeps a parent.

export const listFamilies = (exec: Executor) =>
  exec
    .select({
      id: families.id,
      name: families.name,
      requiresApproval: families.requiresApproval,
      createdAt: families.createdAt,
      members: sql<number>`(select count(*)::int from family_members fm where fm.family_id = families.id)`,
      parents: sql<string>`(select coalesce(string_agg(u.display_name, ', ' order by u.display_name), '') from family_members fm join users u on u.id = fm.user_id where fm.family_id = families.id and fm.role = 'parent')`,
      ownChores: sql<number>`(select count(*)::int from chores c where c.family_id = families.id)`,
      ownRewards: sql<number>`(select count(*)::int from rewards r where r.family_id = families.id)`,
      changes: sql<number>`(select count(*)::int from chore_family_settings s where s.family_id = families.id) + (select count(*)::int from reward_family_settings s where s.family_id = families.id)`,
    })
    .from(families)
    .orderBy(desc(families.createdAt));

/** One family: members, its own chores and rewards, and its changes to global items. Null if not found. */
export async function getFamilyDetail(exec: Executor, familyId: string) {
  const [family] = await exec.select().from(families).where(eq(families.id, familyId));
  if (!family) return null;

  const members = await exec
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt,
      balance: sql<number>`(select coalesce(sum(pl.delta), 0)::int from point_ledger pl where pl.user_id = users.id)`,
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, familyId))
    .orderBy(asc(familyMembers.role), asc(users.displayName));

  const ownChores = await exec.select().from(chores).where(eq(chores.familyId, familyId)).orderBy(desc(chores.isActive), asc(chores.title));
  const ownRewards = await exec.select().from(rewards).where(eq(rewards.familyId, familyId)).orderBy(desc(rewards.isActive), asc(rewards.cost));

  const choreChanges = await exec
    .select({
      choreId: chores.id,
      title: chores.title,
      catalogPoints: chores.points,
      isActive: choreFamilySettings.isActive,
      pointsOverride: choreFamilySettings.pointsOverride,
    })
    .from(choreFamilySettings)
    .innerJoin(chores, eq(chores.id, choreFamilySettings.choreId))
    .where(eq(choreFamilySettings.familyId, familyId))
    .orderBy(asc(chores.title));

  const rewardChanges = await exec
    .select({
      rewardId: rewards.id,
      title: rewards.title,
      catalogCost: rewards.cost,
      isActive: rewardFamilySettings.isActive,
      costOverride: rewardFamilySettings.costOverride,
      stock: rewardFamilySettings.stock,
    })
    .from(rewardFamilySettings)
    .innerJoin(rewards, eq(rewards.id, rewardFamilySettings.rewardId))
    .where(eq(rewardFamilySettings.familyId, familyId))
    .orderBy(asc(rewards.title));

  return {
    family: { ...family, inviteCode: formatInviteCode(family.inviteCode) },
    members,
    ownChores,
    ownRewards,
    choreChanges,
    rewardChanges,
  };
}

// ── Management ───────────────────────────────────────────────────────────────

export type FamilyRole = "parent" | "child";
export type MemberResult = { ok: true } | { ok: false; reason: "not_found" | "user_not_found" | "already_in_family" | "last_parent" };

export async function createFamily(exec: Executor, input: { name: string; requiresApproval: boolean }) {
  const [family] = await exec
    .insert(families)
    .values({ ...input, inviteCode: await unusedInviteCode(exec) })
    .returning({ id: families.id });
  return family.id;
}

export async function updateFamily(exec: Executor, familyId: string, input: { name: string; requiresApproval: boolean }) {
  const updated = await exec.update(families).set(input).where(eq(families.id, familyId)).returning({ id: families.id });
  return updated.length > 0;
}

/** Users that can be added: not deleted and not already in a family. */
export const usersWithoutFamily = (exec: Executor) =>
  exec
    .select({ id: users.id, displayName: users.displayName, email: users.email, provider: users.provider })
    .from(users)
    .where(and(isNull(users.deletedAt), sql`not exists (select 1 from family_members fm where fm.user_id = ${users.id})`))
    .orderBy(asc(users.displayName));

export async function addMember(exec: Executor, familyId: string, userId: string, role: FamilyRole): Promise<MemberResult> {
  return exec.transaction(async (tx) => {
    const [family] = await tx.select({ id: families.id }).from(families).where(eq(families.id, familyId));
    if (!family) return { ok: false, reason: "not_found" };
    const [user] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));
    if (!user) return { ok: false, reason: "user_not_found" };
    // The unique index on family_members.user_id is the real "one family" guard.
    const added = await tx
      .insert(familyMembers)
      .values({ familyId, userId, role })
      .onConflictDoNothing()
      .returning({ userId: familyMembers.userId });
    return added.length > 0 ? { ok: true } : { ok: false, reason: "already_in_family" };
  });
}

/** The family's members, locked so concurrent role changes and removals see each other. */
const lockMembers = (exec: Executor, familyId: string) =>
  exec
    .select({ userId: familyMembers.userId, role: familyMembers.role })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, familyId))
    .for("update");

export async function setMemberRole(exec: Executor, familyId: string, userId: string, role: FamilyRole): Promise<MemberResult> {
  return exec.transaction(async (tx) => {
    const members = await lockMembers(tx, familyId);
    const member = members.find((m) => m.userId === userId);
    if (!member) return { ok: false, reason: "not_found" };
    if (role === "child" && member.role === "parent" && !members.some((m) => m.userId !== userId && m.role === "parent"))
      return { ok: false, reason: "last_parent" };
    await tx.update(familyMembers).set({ role }).where(eq(familyMembers.userId, userId));
    return { ok: true };
  });
}

/** Takes a user out of the family; their points stay theirs. The last parent stays while others remain. */
export async function removeMember(exec: Executor, familyId: string, userId: string): Promise<MemberResult> {
  return exec.transaction(async (tx) => {
    const members = await lockMembers(tx, familyId);
    const member = members.find((m) => m.userId === userId);
    if (!member) return { ok: false, reason: "not_found" };
    const others = members.filter((m) => m.userId !== userId);
    if (member.role === "parent" && others.length > 0 && !others.some((m) => m.role === "parent"))
      return { ok: false, reason: "last_parent" };
    await tx.delete(familyMembers).where(eq(familyMembers.userId, userId));
    return { ok: true };
  });
}
