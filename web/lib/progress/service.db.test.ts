import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { achievements, chores, families, familyMembers, pointLedger, rewards, users } from "../../db/schema";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import {
  completeChore,
  listAchievements,
  listChores,
  listRewards,
  loadStats,
  progressSummary,
  redeemReward,
} from "./service";

// Monday 9 Nov 2026, 10:00 Stockholm (09:00 UTC).
const monday = new Date("2026-11-09T09:00:00Z");
const hoursLater = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

async function seedUser(tx: Executor) {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test" })
    .returning();
  return user.id;
}

async function seedChore(tx: Executor, frequency: "daily" | "weekly" | "monthly" | "once", points = 10) {
  const [chore] = await tx
    .insert(chores)
    .values({ title: `Test ${frequency}`, points, frequency, isGlobal: true })
    .returning();
  return chore.id;
}

/** Global rewards are unlimited; a stocked reward belongs to a family (here: the user's own). */
async function seedReward(tx: Executor, cost: number, stock: number | null, userId?: string) {
  let familyId: string | null = null;
  if (stock !== null) {
    const [family] = await tx.insert(families).values({ name: "Test", inviteCode: randomUUID().slice(0, 8) }).returning();
    await tx.insert(familyMembers).values({ familyId: family.id, userId: userId!, role: "parent" });
    familyId = family.id;
  }
  const [reward] = await tx.insert(rewards).values({ title: "Test reward", cost, stock, familyId }).returning();
  return reward.id;
}

async function grant(tx: Executor, userId: string, delta: number) {
  await tx.insert(pointLedger).values({ userId, delta, reason: "admin_adjustment" });
}

describe.skipIf(!hasDevDatabase)("progress service (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  describe("completeChore (business rule 2: once per Stockholm frequency window)", () => {
    it("awards points once per day and answers 409 for a second try the same day", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const choreId = await seedChore(tx, "daily", 10);

        const first = await completeChore(tx, userId, choreId, monday);
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(first.pointsEarned).toBe(10);
        expect(first.completion.localDate).toBe("2026-11-09");
        const bonus = first.unlockedAchievements.reduce((sum, a) => sum + a.bonusPoints, 0);
        expect(first.balance).toBe(10 + bonus);

        const again = await completeChore(tx, userId, choreId, hoursLater(monday, 2));
        expect(again).toMatchObject({ ok: false, status: 409, code: "chore_already_completed_today" });

        // 23:30 UTC on Monday is already Tuesday in Stockholm: a new daily window.
        const nextDay = await completeChore(tx, userId, choreId, new Date("2026-11-09T23:30:00Z"));
        expect(nextDay.ok).toBe(true);
      });
    });

    it("allows a weekly chore once per ISO week (Monday start)", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const choreId = await seedChore(tx, "weekly");
        expect((await completeChore(tx, userId, choreId, monday)).ok).toBe(true);
        // Sunday evening is still the same week.
        expect(await completeChore(tx, userId, choreId, new Date("2026-11-15T20:00:00Z"))).toMatchObject({
          status: 409,
          code: "chore_already_completed_this_week",
        });
        // Monday 00:30 Stockholm (Sunday 23:30 UTC) is the next week.
        expect((await completeChore(tx, userId, choreId, new Date("2026-11-15T23:30:00Z"))).ok).toBe(true);
      });
    });

    it("allows a monthly chore once per calendar month and a once chore only once", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const monthly = await seedChore(tx, "monthly");
        const once = await seedChore(tx, "once");
        expect((await completeChore(tx, userId, monthly, monday)).ok).toBe(true);
        expect(await completeChore(tx, userId, monthly, new Date("2026-11-30T12:00:00Z"))).toMatchObject({
          code: "chore_already_completed_this_month",
        });
        expect((await completeChore(tx, userId, monthly, new Date("2026-12-01T12:00:00Z"))).ok).toBe(true);

        expect((await completeChore(tx, userId, once, monday)).ok).toBe(true);
        expect(await completeChore(tx, userId, once, new Date("2027-06-01T12:00:00Z"))).toMatchObject({
          code: "chore_already_completed",
        });
      });
    });

    it("answers 404 for unknown and inactive chores", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const choreId = await seedChore(tx, "daily");
        await tx.update(chores).set({ isActive: false }).where(eq(chores.id, choreId));
        expect(await completeChore(tx, userId, choreId, monday)).toMatchObject({ status: 404, code: "chore_not_found" });
        expect(await completeChore(tx, userId, randomUUID(), monday)).toMatchObject({ status: 404 });
      });
    });

    it("marks chores done for their current window in listChores", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const daily = await seedChore(tx, "daily");
        await completeChore(tx, userId, daily, monday);

        const sameDay = (await listChores(tx, userId, hoursLater(monday, 1))).find((c) => c.id === daily);
        expect(sameDay).toMatchObject({ completedThisPeriod: true, completionStatus: "approved" });
        const nextDay = (await listChores(tx, userId, hoursLater(monday, 24))).find((c) => c.id === daily);
        expect(nextDay?.completedThisPeriod).toBe(false);
      });
    });
  });

  describe("redeemReward (business rule 4: atomic; rule 5: sold out stays sold out)", () => {
    it("takes points and stock together, then refuses when sold out", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        await grant(tx, userId, 100);
        const rewardId = await seedReward(tx, 30, 1, userId);

        const bought = await redeemReward(tx, userId, rewardId, monday);
        expect(bought).toMatchObject({ ok: true, redemption: { cost: 30, status: "pending" } });
        if (!bought.ok) return;
        expect(bought.balance).toBe(70 + bought.unlockedAchievements.reduce((s, a) => s + a.bonusPoints, 0));

        const [{ stock }] = await tx.select({ stock: rewards.stock }).from(rewards).where(eq(rewards.id, rewardId));
        expect(stock).toBe(0);
        expect(await redeemReward(tx, userId, rewardId, monday)).toMatchObject({ status: 409, code: "reward_out_of_stock" });
        expect((await listRewards(tx, userId)).find((r) => r.id === rewardId)?.stock).toBe(0);
      });
    });

    it("refuses without enough points and changes nothing", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        await grant(tx, userId, 20);
        const rewardId = await seedReward(tx, 30, 5, userId);

        expect(await redeemReward(tx, userId, rewardId, monday)).toMatchObject({ status: 409, code: "insufficient_points" });
        expect((await loadStats(tx, userId, monday)).balance).toBe(20);
        const [{ stock }] = await tx.select({ stock: rewards.stock }).from(rewards).where(eq(rewards.id, rewardId));
        expect(stock).toBe(5);
      });
    });

    it("never decrements unlimited stock", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        await grant(tx, userId, 100);
        const rewardId = await seedReward(tx, 10, null);
        expect((await redeemReward(tx, userId, rewardId, monday)).ok).toBe(true);
        expect((await redeemReward(tx, userId, rewardId, monday)).ok).toBe(true);
        const [{ stock }] = await tx.select({ stock: rewards.stock }).from(rewards).where(eq(rewards.id, rewardId));
        expect(stock).toBeNull();
      });
    });
  });

  describe("achievements (business rule 1: lifetime earned points)", () => {
    it("unlocks a points achievement even though the points were already spent", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        await grant(tx, userId, 999_990);
        const rewardId = await seedReward(tx, 999_990, null);
        expect((await redeemReward(tx, userId, rewardId, monday)).ok).toBe(true); // spends it all

        // Threshold 10 above lifetime earned so far — far above the (almost empty) balance.
        const before = await loadStats(tx, userId, monday);
        const code = `test_pts_${randomUUID()}`;
        const threshold = before.lifetimeEarned + 10;
        expect(before.balance).toBeLessThan(threshold - 1000);
        await tx.insert(achievements).values({ code, title: "Test", ruleType: "lifetime_points_earned", threshold });

        const choreId = await seedChore(tx, "daily", 10);
        const done = await completeChore(tx, userId, choreId, monday);
        expect(done.ok && done.unlockedAchievements.map((a) => a.code)).toContain(code);

        const listed = (await listAchievements(tx, userId)).find((a) => a.code === code);
        expect(listed?.unlockedAt).toEqual(monday);
      });
    });

    it("never unlocks inactive achievements and hides them unless already unlocked", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const hidden = `test_hidden_${randomUUID()}`;
        const kept = `test_kept_${randomUUID()}`;
        await tx.insert(achievements).values([
          { code: hidden, title: "Hidden", ruleType: "chores_completed", threshold: 1, isActive: false },
          { code: kept, title: "Kept", ruleType: "chores_completed", threshold: 1 },
        ]);

        const done = await completeChore(tx, userId, await seedChore(tx, "daily"), monday);
        const codes = done.ok ? done.unlockedAchievements.map((a) => a.code) : [];
        expect(codes).toContain(kept);
        expect(codes).not.toContain(hidden);

        // Deactivating after the unlock keeps it visible for this user.
        await tx.update(achievements).set({ isActive: false }).where(eq(achievements.code, kept));
        const listed = (await listAchievements(tx, userId)).map((a) => a.code);
        expect(listed).toContain(kept);
        expect(listed).not.toContain(hidden);
      });
    });

    it("books the bonus once and reports it in the summary", async () => {
      await inRollback(async (tx) => {
        const userId = await seedUser(tx);
        const choreId = await seedChore(tx, "daily", 10);
        const done = await completeChore(tx, userId, choreId, monday);
        if (!done.ok) throw new Error("expected success");
        const first = done.unlockedAchievements.find((a) => a.code === "first_chore");
        expect(first).toBeDefined();

        const summary = await progressSummary(tx, userId, monday);
        expect(summary.balance).toBe(done.balance);
        expect(summary.lifetimeEarned).toBe(done.balance);
        expect(summary.choresCompleted).toBe(1);
        expect(summary.streakDays).toBe(1);
        expect(summary.choresDoneThisPeriod).toBe(1);
        expect(summary.recentAchievements.map((a) => a.code)).toContain("first_chore");

        // A second chore must not unlock first_chore again.
        const other = await seedChore(tx, "daily", 5);
        const second = await completeChore(tx, userId, other, monday);
        expect(second.ok && second.unlockedAchievements.map((a) => a.code)).not.toContain("first_chore");
      });
    });
  });
});
