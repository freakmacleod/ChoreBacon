import { asc, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { choreFamilySettings, chores, families, familyMembers, rewardFamilySettings, rewards, users } from "../../db/schema";

// Read-only admin view of families: who is in which family, and what each family has changed or added
// on top of the global catalog. Parents manage their family in the app; the admin only looks.

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

  return { family, members, ownChores, ownRewards, choreChanges, rewardChanges };
}
