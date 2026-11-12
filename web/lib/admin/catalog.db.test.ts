import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { pointLedger, users } from "../../db/schema";
import {
  listAchievements as appAchievements,
  listChores as appChores,
  listRewards as appRewards,
  completeChore,
  redeemReward,
} from "../progress/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import {
  createAchievement,
  createChore,
  createReward,
  findAdmin,
  getChore,
  getReward,
  listAchievements,
  listChores,
  listUsers,
  setChoreActive,
  setRewardActive,
  setUserRole,
  updateAchievement,
  updateChore,
  updateReward,
} from "./catalog";
import * as families from "./families";
import type { SaveResult } from "./catalog";
import type { AchievementInput, ChoreInput, RewardInput } from "./schemas";

const now = new Date("2026-11-09T09:00:00Z");
const chore: ChoreInput = { title: "Test admin chore", description: "", icon: "dishes", points: 10, frequency: "daily", isActive: true };
const reward: RewardInput = { title: "Test admin reward", description: "", icon: "reward_game", cost: 10, stock: null, isActive: true };
const achievement = (code: string): AchievementInput => ({
  code,
  title: "Test",
  description: "",
  icon: "ach_10",
  ruleType: "chores_completed",
  threshold: 5,
  bonusPoints: 0,
  rarity: "common",
  isActive: true,
});

const idOf = (result: SaveResult) => {
  if (!result.ok) throw new Error(`save failed: ${result.reason}`);
  return result.id;
};

/** A family with one parent and one child (placed by the admin). */
async function seedFamily(tx: Executor) {
  const familyId = await families.createFamily(tx, { name: `Testfamilj ${randomUUID().slice(0, 6)}`, requiresApproval: false });
  const parent = await seedUser(tx);
  const child = await seedUser(tx);
  await families.addMember(tx, familyId, parent, "parent");
  await families.addMember(tx, familyId, child, "child");
  return { familyId, parent, child };
}

async function seedUser(tx: Executor, role: "user" | "admin" = "user") {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test", role })
    .returning();
  return user.id;
}

describe.skipIf(!hasDevDatabase)("admin catalog (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("creates, edits and deactivates a global chore; the app only sees active ones", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const id = idOf(await createChore(tx, chore, null));
      expect((await getChore(tx, id))?.isGlobal).toBe(true);

      expect(await updateChore(tx, id, { ...chore, points: 25 })).toEqual({ ok: true, id });
      expect((await appChores(tx, userId, now)).find((c) => c.id === id)?.points).toBe(25);

      expect(await setChoreActive(tx, id, false)).toBe(true);
      expect((await appChores(tx, userId, now)).some((c) => c.id === id)).toBe(false);
      expect(await getChore(tx, id)).not.toBeNull(); // deactivated, not deleted
      expect(await updateChore(tx, randomUUID(), chore)).toEqual({ ok: false, reason: "not_found" });
    });
  });

  it("edits and deactivates a global reward, which is always unlimited", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      await tx.insert(pointLedger).values({ userId, delta: 100, reason: "admin_adjustment" });
      const id = idOf(await createReward(tx, reward, null));

      expect((await redeemReward(tx, userId, id, now)).ok).toBe(true);
      expect((await redeemReward(tx, userId, id, now)).ok).toBe(true);
      expect((await appRewards(tx, userId)).find((r) => r.id === id)?.stock).toBeNull();

      expect(await updateReward(tx, id, { ...reward, cost: 20 })).toEqual({ ok: true, id });
      expect(await updateReward(tx, id, { ...reward, stock: 3 })).toEqual({ ok: false, reason: "global_stock" });
      expect(await createReward(tx, { ...reward, stock: 3 }, null)).toEqual({ ok: false, reason: "global_stock" });
      expect((await appRewards(tx, userId)).find((r) => r.id === id)?.cost).toBe(20);

      expect(await setRewardActive(tx, id, false)).toBe(true);
      expect((await appRewards(tx, userId)).some((r) => r.id === id)).toBe(false);
    });
  });

  it("refuses duplicate achievement codes on create and update", async () => {
    await inRollback(async (tx) => {
      const a = `test_a_${randomUUID().slice(0, 8)}`;
      const b = `test_b_${randomUUID().slice(0, 8)}`;
      const first = await createAchievement(tx, achievement(a), null);
      expect(first.ok).toBe(true);
      expect(await createAchievement(tx, achievement(a), null)).toEqual({ ok: false, reason: "duplicate_code" });

      const second = await createAchievement(tx, achievement(b), null);
      if (!second.ok) throw new Error("expected create");
      expect(await updateAchievement(tx, second.id, achievement(a))).toEqual({ ok: false, reason: "duplicate_code" });
      expect(await updateAchievement(tx, second.id, { ...achievement(b), threshold: 9 })).toEqual({ ok: true, id: second.id });
    });
  });

  it("creates family-only chores and rewards that only the family sees", async () => {
    await inRollback(async (tx) => {
      const { familyId, parent, child } = await seedFamily(tx);
      const outsider = await seedUser(tx);

      const choreId = idOf(await createChore(tx, { ...chore, title: "Familjesyssla" }, familyId));
      const rewardId = idOf(await createReward(tx, { ...reward, title: "Familjebelöning", stock: 2 }, familyId));
      expect(await getChore(tx, choreId)).toMatchObject({ isGlobal: false, familyId, familyName: expect.stringContaining("Testfamilj") });
      expect(await getReward(tx, rewardId)).toMatchObject({ familyId, stock: 2 });

      for (const member of [parent, child]) {
        expect((await appChores(tx, member, now)).find((c) => c.id === choreId)?.isFamilyItem).toBe(true);
        expect((await appRewards(tx, member)).find((r) => r.id === rewardId)).toMatchObject({ isFamilyItem: true, stock: 2 });
      }
      expect((await appChores(tx, outsider, now)).some((c) => c.id === choreId)).toBe(false);
      expect((await appRewards(tx, outsider)).some((r) => r.id === rewardId)).toBe(false);

      // An edit never moves the item; a family reward's stock can be set (an explicit restock).
      expect(await updateReward(tx, rewardId, { ...reward, title: "Familjebelöning", stock: 5 })).toEqual({ ok: true, id: rewardId });
      expect(await getReward(tx, rewardId)).toMatchObject({ familyId, stock: 5 });
      expect(await updateChore(tx, choreId, { ...chore, points: 3 })).toEqual({ ok: true, id: choreId });
      expect((await getChore(tx, choreId))?.familyId).toBe(familyId);

      expect(await createChore(tx, chore, randomUUID())).toEqual({ ok: false, reason: "family_not_found" });
    });
  });

  it("filters the admin lists by scope", async () => {
    await inRollback(async (tx) => {
      const { familyId } = await seedFamily(tx);
      const globalId = idOf(await createChore(tx, { ...chore, title: "Global" }, null));
      const familyChoreId = idOf(await createChore(tx, { ...chore, title: "Familj" }, familyId));

      const ids = async (filter: Parameters<typeof listChores>[1]) => (await listChores(tx, filter)).map((c) => c.id);
      expect(await ids("all")).toEqual(expect.arrayContaining([globalId, familyChoreId]));
      expect(await ids("global")).toContain(globalId);
      expect(await ids("global")).not.toContain(familyChoreId);
      expect(await ids({ familyId })).toEqual([familyChoreId]);
      expect((await listChores(tx)).find((c) => c.id === familyChoreId)?.familyName).toContain("Testfamilj");
    });
  });

  it("lets only the family's members see and unlock a family achievement", async () => {
    await inRollback(async (tx) => {
      const { familyId, child } = await seedFamily(tx);
      const outsider = await seedUser(tx);
      const code = `test_fam_${randomUUID().slice(0, 8)}`;
      const achievementId = idOf(await createAchievement(tx, { ...achievement(code), threshold: 1 }, familyId));
      expect((await listAchievements(tx, { familyId })).map((a) => a.id)).toEqual([achievementId]);

      const choreId = idOf(await createChore(tx, chore, null));
      expect((await completeChore(tx, child, choreId, now)).ok).toBe(true);
      expect((await completeChore(tx, outsider, choreId, now)).ok).toBe(true);

      expect((await appAchievements(tx, child)).find((a) => a.id === achievementId)).toMatchObject({ isFamilyItem: true, unlockedAt: now });
      expect((await appAchievements(tx, outsider)).some((a) => a.id === achievementId)).toBe(false);

      // Leaving the family keeps what was unlocked, still visible.
      await families.removeMember(tx, familyId, child);
      expect((await appAchievements(tx, child)).find((a) => a.id === achievementId)?.unlockedAt).toEqual(now);
    });
  });

  it("guards role changes: no self-demotion, and admin status is read fresh", async () => {
    await inRollback(async (tx) => {
      const admin = await seedUser(tx, "admin");
      const other = await seedUser(tx);

      expect(await setUserRole(tx, admin, admin, "user")).toEqual({ ok: false, reason: "cannot_demote_self" });
      expect(await findAdmin(tx, other)).toBeNull();
      expect(await setUserRole(tx, admin, other, "admin")).toEqual({ ok: true });
      expect(await findAdmin(tx, other)).not.toBeNull();
      expect(await setUserRole(tx, admin, other, "user")).toEqual({ ok: true });
      expect(await findAdmin(tx, other)).toBeNull();
      expect(await setUserRole(tx, admin, randomUUID(), "admin")).toEqual({ ok: false, reason: "not_found" });

      const listed = (await listUsers(tx)).find((u) => u.id === admin);
      expect(listed).toMatchObject({ role: "admin", balance: 0, choresCompleted: 0 });
    });
  });
});
