import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { pointLedger, users } from "../../db/schema";
import { listChores as appChores, listRewards as appRewards, redeemReward } from "../progress/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import {
  createAchievement,
  createChore,
  createReward,
  findAdmin,
  getChore,
  listUsers,
  setChoreActive,
  setRewardActive,
  setUserRole,
  updateAchievement,
  updateChore,
  updateReward,
} from "./catalog";
import type { AchievementInput, ChoreInput, RewardInput } from "./schemas";

const now = new Date("2026-11-09T09:00:00Z");
const chore: ChoreInput = { title: "Test admin chore", description: "", icon: "dishes", points: 10, frequency: "daily", isActive: true };
const reward: RewardInput = { title: "Test admin reward", description: "", icon: "reward_game", cost: 10, stock: 1, isActive: true };
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

async function seedUser(tx: Executor, role: "user" | "admin" = "user") {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test", role })
    .returning();
  return user.id;
}

describe.skipIf(!hasDevDatabase)("admin catalog (development database, rolled back)", () => {
  afterAll(closeDevDatabase);

  it("creates, edits and deactivates a global chore; the app only sees active ones", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const id = await createChore(tx, chore);
      expect((await getChore(tx, id))?.isGlobal).toBe(true);

      expect(await updateChore(tx, id, { ...chore, points: 25 })).toBe(true);
      expect((await appChores(tx, userId, now)).find((c) => c.id === id)?.points).toBe(25);

      expect(await setChoreActive(tx, id, false)).toBe(true);
      expect((await appChores(tx, userId, now)).some((c) => c.id === id)).toBe(false);
      expect(await getChore(tx, id)).not.toBeNull(); // deactivated, not deleted
      expect(await updateChore(tx, randomUUID(), chore)).toBe(false);
    });
  });

  it("lets an admin restock a sold-out reward explicitly", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      await tx.insert(pointLedger).values({ userId, delta: 100, reason: "admin_adjustment" });
      const id = await createReward(tx, reward);

      expect((await redeemReward(tx, userId, id, now)).ok).toBe(true);
      expect(await redeemReward(tx, userId, id, now)).toMatchObject({ code: "reward_out_of_stock" });

      expect(await updateReward(tx, id, { ...reward, stock: 2 })).toBe(true);
      expect((await redeemReward(tx, userId, id, now)).ok).toBe(true);

      expect(await setRewardActive(tx, id, false)).toBe(true);
      expect((await appRewards(tx)).some((r) => r.id === id)).toBe(false);
    });
  });

  it("refuses duplicate achievement codes on create and update", async () => {
    await inRollback(async (tx) => {
      const a = `test_a_${randomUUID().slice(0, 8)}`;
      const b = `test_b_${randomUUID().slice(0, 8)}`;
      const first = await createAchievement(tx, achievement(a));
      expect(first.ok).toBe(true);
      expect(await createAchievement(tx, achievement(a))).toEqual({ ok: false, reason: "duplicate_code" });

      const second = await createAchievement(tx, achievement(b));
      if (!second.ok) throw new Error("expected create");
      expect(await updateAchievement(tx, second.id, achievement(a))).toEqual({ ok: false, reason: "duplicate_code" });
      expect(await updateAchievement(tx, second.id, { ...achievement(b), threshold: 9 })).toEqual({ ok: true, id: second.id });
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
