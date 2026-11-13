import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { choreFamilySettings, chores, comboChores, combos, families, familyMembers, pointLedger, users } from "../../db/schema";
import { reviewCompletion } from "../family/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import { completeChore, listCombos } from "./service";

// Monday 9 Nov 2026, 10:00 Stockholm (09:00 UTC).
const monday = new Date("2026-11-09T09:00:00Z");
const daysLater = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
const hoursLater = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

async function seedUser(tx: Executor) {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test" })
    .returning();
  return user.id;
}

async function seedChore(tx: Executor, frequency: "daily" | "weekly", familyId: string | null = null) {
  const [chore] = await tx
    .insert(chores)
    .values({ title: `Test ${frequency} ${randomUUID().slice(0, 4)}`, points: 10, frequency, isGlobal: familyId === null, familyId })
    .returning();
  return chore.id;
}

async function seedCombo(
  tx: Executor,
  period: "day" | "week",
  choreIds: string[],
  options: { bonusPoints?: number; familyId?: string | null; isActive?: boolean } = {},
) {
  const [combo] = await tx
    .insert(combos)
    .values({ title: "Test combo", period, bonusPoints: options.bonusPoints ?? 25, familyId: options.familyId ?? null, isActive: options.isActive ?? true })
    .returning();
  await tx.insert(comboChores).values(choreIds.map((choreId) => ({ comboId: combo.id, choreId })));
  return combo.id;
}

async function seedFamily(tx: Executor, requiresApproval = false) {
  const [family] = await tx.insert(families).values({ name: "Test", requiresApproval, inviteCode: randomUUID().slice(0, 8) }).returning();
  return family.id;
}

const comboBonusesBooked = async (tx: Executor, userId: string) =>
  (await tx.select().from(pointLedger).where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, "combo_bonus")))).map((r) => r.delta);

const bonusesOf = (result: Awaited<ReturnType<typeof completeChore>>) => (result.ok ? result.comboBonuses.map((b) => b.bonusPoints) : null);

describe.skipIf(!hasDevDatabase)("combos (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("pays a day combo once when its last chore is done, and again the next day", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const [a, b] = [await seedChore(tx, "daily"), await seedChore(tx, "daily")];
      const comboId = await seedCombo(tx, "day", [a, b], { bonusPoints: 25 });

      expect(bonusesOf(await completeChore(tx, userId, a, monday))).toEqual([]);
      const second = await completeChore(tx, userId, b, hoursLater(monday, 3));
      expect(bonusesOf(second)).toEqual([25]);
      expect(second.ok && second.comboBonuses[0].comboId).toBe(comboId);

      const [listed] = (await listCombos(tx, userId, hoursLater(monday, 4))).filter((c) => c.id === comboId);
      expect(listed.awardedThisPeriod).toBe(true);
      expect(listed.chores.every((c) => c.done && !c.pending)).toBe(true);

      // Tuesday: a new day window, nothing done yet.
      const tuesday = daysLater(monday, 1);
      const [fresh] = (await listCombos(tx, userId, tuesday)).filter((c) => c.id === comboId);
      expect(fresh).toMatchObject({ awardedThisPeriod: false });
      expect(fresh.chores.some((c) => c.done)).toBe(false);
      await completeChore(tx, userId, a, tuesday);
      expect(bonusesOf(await completeChore(tx, userId, b, tuesday))).toEqual([25]);
      expect(await comboBonusesBooked(tx, userId)).toEqual([25, 25]);
    });
  });

  it("measures a day combo in Stockholm time, not UTC", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const [a, b] = [await seedChore(tx, "daily"), await seedChore(tx, "daily")];
      await seedCombo(tx, "day", [a, b]);
      // 22:30 Monday and 00:30 Tuesday in Stockholm (both Monday in UTC).
      await completeChore(tx, userId, a, new Date("2026-11-09T21:30:00Z"));
      expect(bonusesOf(await completeChore(tx, userId, b, new Date("2026-11-09T23:30:00Z")))).toEqual([]);
    });
  });

  it("pays a week combo once per ISO week, mixing daily and weekly chores", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const [daily, weekly] = [await seedChore(tx, "daily"), await seedChore(tx, "weekly")];
      await seedCombo(tx, "week", [daily, weekly], { bonusPoints: 40 });

      await completeChore(tx, userId, daily, monday);
      expect(bonusesOf(await completeChore(tx, userId, weekly, daysLater(monday, 3)))).toEqual([40]);
      // Doing the daily chore again on Friday does not pay the week's combo twice.
      expect(bonusesOf(await completeChore(tx, userId, daily, daysLater(monday, 4)))).toEqual([]);
      // Next week starts over.
      await completeChore(tx, userId, weekly, daysLater(monday, 7));
      expect(bonusesOf(await completeChore(tx, userId, daily, daysLater(monday, 8)))).toEqual([40]);
    });
  });

  it("waits for a parent's approval and measures from the day the chore was done", async () => {
    await inRollback(async (tx) => {
      const [parentId, childId] = [await seedUser(tx), await seedUser(tx)];
      const familyId = await seedFamily(tx, true);
      await tx.insert(familyMembers).values([
        { familyId, userId: parentId, role: "parent" },
        { familyId, userId: childId, role: "child" },
      ]);
      const [a, b] = [await seedChore(tx, "daily"), await seedChore(tx, "daily", familyId)];
      const comboId = await seedCombo(tx, "day", [a, b], { familyId, bonusPoints: 30 });

      const first = await completeChore(tx, childId, a, monday);
      const second = await completeChore(tx, childId, b, monday);
      expect([bonusesOf(first), bonusesOf(second)]).toEqual([[], []]);
      const [listed] = (await listCombos(tx, childId, monday)).filter((c) => c.id === comboId);
      expect(listed.chores.every((c) => c.done && c.pending)).toBe(true);

      // Approved on Tuesday: still Monday's combo.
      const tuesday = daysLater(monday, 1);
      const approveA = await reviewCompletion(tx, parentId, first.ok ? first.completion.id : "", true, tuesday);
      expect(approveA.ok && approveA.comboBonuses).toEqual([]);
      const approveB = await reviewCompletion(tx, parentId, second.ok ? second.completion.id : "", true, tuesday);
      expect(approveB.ok && approveB.comboBonuses.map((c) => c.bonusPoints)).toEqual([30]);
      expect(await comboBonusesBooked(tx, childId)).toEqual([30]);
    });
  });

  it("shows a family's combo only to its members and skips combos that cannot be completed", async () => {
    await inRollback(async (tx) => {
      const [memberId, soloId] = [await seedUser(tx), await seedUser(tx)];
      const familyId = await seedFamily(tx);
      await tx.insert(familyMembers).values({ familyId, userId: memberId, role: "parent" });
      const [a, b] = [await seedChore(tx, "daily"), await seedChore(tx, "daily")];
      const familyCombo = await seedCombo(tx, "day", [a, b], { familyId });
      const inactive = await seedCombo(tx, "day", [a, b], { isActive: false });
      const ids = async (userId: string) => (await listCombos(tx, userId, monday)).map((c) => c.id);

      expect(await ids(memberId)).toContain(familyCombo);
      expect(await ids(soloId)).not.toContain(familyCombo);
      expect(await ids(memberId)).not.toContain(inactive);

      // The family switched one of its chores off: the combo is hidden and never pays.
      await tx.insert(choreFamilySettings).values({ familyId, choreId: b, isActive: false });
      expect(await ids(memberId)).not.toContain(familyCombo);
      expect(bonusesOf(await completeChore(tx, memberId, a, monday))).toEqual([]);
    });
  });
});
