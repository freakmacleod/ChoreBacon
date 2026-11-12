import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { chores, families, pointLedger, rewards, users } from "../../db/schema";
import { completeChore, listChores, listRewards, loadStats, redeemReward } from "../progress/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import * as family from "./service";

// Monday 9 Nov 2026, 10:00 Stockholm.
const now = new Date("2026-11-09T09:00:00Z");

async function seedUser(tx: Executor, name = "Test") {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: name })
    .returning();
  return user.id;
}

async function seedChore(tx: Executor, points = 10) {
  const [chore] = await tx
    .insert(chores)
    .values({ title: `Test chore ${randomUUID().slice(0, 6)}`, points, frequency: "daily", isGlobal: true })
    .returning();
  return chore.id;
}

async function seedReward(tx: Executor, cost = 10) {
  const [reward] = await tx.insert(rewards).values({ title: "Test reward", cost }).returning();
  return reward.id;
}

const grant = (tx: Executor, userId: string, delta: number) =>
  tx.insert(pointLedger).values({ userId, delta, reason: "admin_adjustment" });

/** A family with one parent and one child. */
async function seedFamily(tx: Executor, { requiresApproval = false } = {}) {
  const parent = await seedUser(tx, "Förälder");
  const child = await seedUser(tx, "Barn");
  const created = await family.createFamily(tx, parent, "Testfamiljen");
  if (!created.ok) throw new Error("create failed");
  const [{ inviteCode }] = await tx.select({ inviteCode: families.inviteCode }).from(families).where(eq(families.id, created.familyId));
  expect((await family.joinFamily(tx, child, inviteCode.toLowerCase())).ok).toBe(true);
  if (requiresApproval) expect((await family.updateFamily(tx, parent, { requiresApproval: true })).ok).toBe(true);
  return { parent, child, familyId: created.familyId, inviteCode };
}

describe.skipIf(!hasDevDatabase)("families (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  describe("membership", () => {
    it("makes the creator a parent and joiners children; the code is only shown to parents", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx);
        const asParent = await family.getFamily(tx, parent);
        const asChild = await family.getFamily(tx, child);
        expect(asParent.ok && asParent.family.role).toBe("parent");
        expect(asParent.ok && asParent.family.inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(asChild.ok && [asChild.family.role, asChild.family.inviteCode]).toEqual(["child", null]);
        expect(asParent.ok && asParent.family.members.map((m) => m.role).sort()).toEqual(["child", "parent"]);
      });
    });

    it("allows one family per user and rejects unknown codes", async () => {
      await inRollback(async (tx) => {
        const { child, inviteCode } = await seedFamily(tx);
        expect(await family.joinFamily(tx, child, inviteCode)).toMatchObject({ status: 409, code: "already_in_family" });
        expect(await family.createFamily(tx, child, "Annan")).toMatchObject({ status: 409, code: "already_in_family" });
        expect(await family.joinFamily(tx, await seedUser(tx), "AAAA-AAAA")).toMatchObject({ status: 404, code: "invalid_invite_code" });
        expect(await family.getFamily(tx, await seedUser(tx))).toMatchObject({ status: 404, code: "no_family" });
      });
    });

    it("keeps at least one parent: the last parent can neither leave nor be demoted", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx);
        expect(await family.leaveFamily(tx, parent)).toMatchObject({ code: "last_parent" });
        expect(await family.setMemberRole(tx, parent, parent, "child")).toMatchObject({ code: "last_parent" });
        expect(await family.setMemberRole(tx, child, parent, "child")).toMatchObject({ status: 403, code: "not_parent" });

        expect((await family.setMemberRole(tx, parent, child, "parent")).ok).toBe(true);
        expect((await family.leaveFamily(tx, parent)).ok).toBe(true);
        expect(await family.getFamily(tx, parent)).toMatchObject({ code: "no_family" });
      });
    });

    it("lets a parent regenerate the code; the old one stops working", async () => {
      await inRollback(async (tx) => {
        const { parent, inviteCode } = await seedFamily(tx);
        const fresh = await family.regenerateInviteCode(tx, parent);
        expect(fresh.ok && fresh.inviteCode).not.toBe(inviteCode);
        expect(await family.joinFamily(tx, await seedUser(tx), inviteCode)).toMatchObject({ code: "invalid_invite_code" });
        expect((await family.joinFamily(tx, await seedUser(tx), fresh.ok ? fresh.inviteCode : "")).ok).toBe(true);
      });
    });
  });

  describe("parent approval", () => {
    it("holds a child's points until a parent approves, then books them", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx, { requiresApproval: true });
        const choreId = await seedChore(tx, 10);

        const done = await completeChore(tx, child, choreId, now);
        expect(done).toMatchObject({ ok: true, pointsEarned: 0, pointsPending: 10, balance: 0, completion: { status: "pending" } });
        expect((await listChores(tx, child, now)).find((c) => c.id === choreId)).toMatchObject({ completedThisPeriod: true, completionStatus: "pending" });
        // Pending still counts for the frequency window.
        expect(await completeChore(tx, child, choreId, now)).toMatchObject({ code: "chore_already_completed_today" });

        const pending = await family.pendingCompletions(tx, parent);
        const item = pending.ok ? pending.items.find((i) => i.choreId === choreId) : undefined;
        expect(item).toMatchObject({ userId: child, displayName: "Barn", points: 10 });
        expect(await family.pendingCompletions(tx, child)).toMatchObject({ status: 403 });

        const approved = await family.reviewCompletion(tx, parent, item!.id, true, now);
        expect(approved.ok && approved.unlockedAchievements.map((a) => a.code)).toContain("first_chore");
        const stats = await loadStats(tx, child, now);
        expect(stats.choresCompleted).toBe(1);
        expect(stats.balance).toBe(10 + (approved.ok ? approved.unlockedAchievements.reduce((s, a) => s + a.bonusPoints, 0) : 0));
        expect(await family.reviewCompletion(tx, parent, item!.id, false, now)).toMatchObject({ code: "not_pending" });
      });
    });

    it("books the points stored at completion, even if the override changes before approval", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx, { requiresApproval: true });
        const choreId = await seedChore(tx, 10);
        await family.setChoreSettings(tx, parent, choreId, { isActive: true, pointsOverride: 30 });
        const done = await completeChore(tx, child, choreId, now);
        expect(done.ok && done.pointsPending).toBe(30);
        await family.setChoreSettings(tx, parent, choreId, { isActive: true, pointsOverride: 5 });

        await family.reviewCompletion(tx, parent, done.ok ? done.completion.id : "", true, now);
        const [booked] = await tx.select().from(pointLedger).where(eq(pointLedger.refId, done.ok ? done.completion.id : ""));
        expect(booked.delta).toBe(30);
      });
    });

    it("frees the slot when rejected, and approves parents' own completions immediately", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx, { requiresApproval: true });
        const choreId = await seedChore(tx, 10);
        const done = await completeChore(tx, child, choreId, now);
        expect((await family.reviewCompletion(tx, parent, done.ok ? done.completion.id : "", false, now)).ok).toBe(true);
        expect((await loadStats(tx, child, now)).balance).toBe(0);
        expect((await completeChore(tx, child, choreId, now)).ok).toBe(true); // same day, slot is free again

        expect(await completeChore(tx, parent, choreId, now)).toMatchObject({ ok: true, pointsEarned: 10, completion: { status: "approved" } });
      });
    });

    it("does not let a parent review completions outside their family", async () => {
      await inRollback(async (tx) => {
        const a = await seedFamily(tx, { requiresApproval: true });
        const b = await seedFamily(tx, { requiresApproval: true });
        const done = await completeChore(tx, a.child, await seedChore(tx), now);
        expect(await family.reviewCompletion(tx, b.parent, done.ok ? done.completion.id : "", true, now)).toMatchObject({
          status: 404,
          code: "completion_not_found",
        });
      });
    });
  });

  describe("the family's catalog", () => {
    it("applies switched-off chores, point overrides and family-only chores to members only", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx);
        const solo = await seedUser(tx);
        const hidden = await seedChore(tx, 10);
        const boosted = await seedChore(tx, 10);
        expect((await family.setChoreSettings(tx, parent, hidden, { isActive: false, pointsOverride: null })).ok).toBe(true);
        expect((await family.setChoreSettings(tx, parent, boosted, { isActive: true, pointsOverride: 25 })).ok).toBe(true);
        const own = await family.createFamilyChore(tx, parent, {
          title: "Rasta hunden",
          description: "",
          icon: "pet",
          points: 15,
          frequency: "daily",
          isActive: true,
        });
        const ownId = own.ok ? own.id : "";

        const childView = await listChores(tx, child, now);
        expect(childView.some((c) => c.id === hidden)).toBe(false);
        expect(childView.find((c) => c.id === boosted)?.points).toBe(25);
        expect(childView.find((c) => c.id === ownId)).toMatchObject({ points: 15, isFamilyItem: true });
        expect(childView.find((c) => c.id === boosted)?.isFamilyItem).toBe(false);
        expect(await completeChore(tx, child, hidden, now)).toMatchObject({ status: 404 });
        expect(await completeChore(tx, child, boosted, now)).toMatchObject({ ok: true, pointsEarned: 25 });

        const soloView = await listChores(tx, solo, now);
        expect(soloView.some((c) => c.id === hidden)).toBe(true);
        expect(soloView.find((c) => c.id === boosted)?.points).toBe(10);
        expect(soloView.some((c) => c.id === ownId)).toBe(false);

        expect(await family.setChoreSettings(tx, child, boosted, { isActive: false, pointsOverride: null })).toMatchObject({ status: 403 });
        expect(await family.setChoreSettings(tx, parent, ownId, { isActive: false, pointsOverride: null })).toMatchObject({ status: 404 });
      });
    });

    it("counts stock per family: one family selling out never affects others (rules 4 and 5)", async () => {
      await inRollback(async (tx) => {
        const a = await seedFamily(tx);
        const b = await seedFamily(tx);
        const solo = await seedUser(tx);
        for (const user of [a.child, b.child, solo]) await grant(tx, user, 100);
        const rewardId = await seedReward(tx, 10);
        await family.setRewardSettings(tx, a.parent, rewardId, { isActive: true, costOverride: 20, stock: 1 });

        expect((await listRewards(tx, a.child)).find((r) => r.id === rewardId)).toMatchObject({ cost: 20, stock: 1 });
        expect(await redeemReward(tx, a.child, rewardId, now)).toMatchObject({ ok: true, balance: expect.any(Number) });
        expect(await redeemReward(tx, a.child, rewardId, now)).toMatchObject({ status: 409, code: "reward_out_of_stock" });

        // Family B and solo users: unlimited, catalog price.
        expect((await listRewards(tx, b.child)).find((r) => r.id === rewardId)).toMatchObject({ cost: 10, stock: null });
        expect((await redeemReward(tx, b.child, rewardId, now)).ok).toBe(true);
        expect((await redeemReward(tx, solo, rewardId, now)).ok).toBe(true);

        // Only a parent's explicit restock brings it back.
        await family.setRewardSettings(tx, a.parent, rewardId, { isActive: true, costOverride: 20, stock: 2 });
        expect((await redeemReward(tx, a.child, rewardId, now)).ok).toBe(true);
      });
    });

    it("decrements a family-only reward's own stock and lets a parent hand redemptions over", async () => {
      await inRollback(async (tx) => {
        const { parent, child } = await seedFamily(tx);
        await grant(tx, child, 100);
        const own = await family.createFamilyReward(tx, parent, {
          title: "Bio",
          description: "",
          icon: "reward_movie",
          cost: 40,
          stock: 1,
          isActive: true,
        });
        const rewardId = own.ok ? own.id : "";
        const bought = await redeemReward(tx, child, rewardId, now);
        if (!bought.ok) throw new Error("expected redemption");
        expect(bought.balance).toBe(60 + bought.unlockedAchievements.reduce((s, a) => s + a.bonusPoints, 0));
        expect(await redeemReward(tx, child, rewardId, now)).toMatchObject({ code: "reward_out_of_stock" });
        expect((await listRewards(tx, await seedUser(tx))).some((r) => r.id === rewardId)).toBe(false);
        expect((await listRewards(tx, child)).find((r) => r.id === rewardId)?.isFamilyItem).toBe(true);

        const pending = await family.pendingRedemptions(tx, parent);
        const redemptionId = bought.ok ? bought.redemption.id : "";
        expect(pending.ok && pending.items.map((i) => i.id)).toContain(redemptionId);
        expect(await family.fulfilRedemption(tx, child, redemptionId)).toMatchObject({ status: 403 });
        expect((await family.fulfilRedemption(tx, parent, redemptionId)).ok).toBe(true);
        expect(await family.fulfilRedemption(tx, parent, redemptionId)).toMatchObject({ status: 404 });
      });
    });

    it("keeps global rewards unlimited at the database level", async () => {
      await inRollback(async (tx) => {
        await expect(tx.insert(rewards).values({ title: "x", cost: 1, stock: 3 })).rejects.toThrow();
      });
    });
  });
});
