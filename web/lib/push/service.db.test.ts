import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { choreFamilySettings, chores, comboChores, combos, deviceTokens, families, familyMembers, users } from "../../db/schema";
import { completeChore } from "../progress/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import type { PushMessage, SendResult } from "./fcm";
import { announceCombo, announceTemporaryChore, notifyUsers, registerDevice, reminderSlot, sendReminders, unregisterDevice } from "./service";

// Friday 13 Nov 2026, 16:30 Stockholm (15:30 UTC).
const afternoon = new Date("2026-11-13T15:30:00Z");

/** Records what would have been sent; tokens starting with "dead" are reported unregistered. */
function fakeSender() {
  const sent: { tokens: string[]; message: PushMessage }[] = [];
  const send = async (tokens: string[], message: PushMessage) => {
    sent.push({ tokens: [...tokens].sort(), message });
    return new Map<string, SendResult>(tokens.map((t) => [t, t.startsWith("dead") ? "invalid_token" : "sent"]));
  };
  return { sent, send };
}

async function seedUser(tx: Executor, token?: string) {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test" })
    .returning();
  if (token) await registerDevice(tx, user.id, token, "android", afternoon);
  return user.id;
}

async function seedFamily(tx: Executor, members: { role: "parent" | "child"; token: string }[]) {
  const [family] = await tx.insert(families).values({ name: "Test", inviteCode: randomUUID().slice(0, 8) }).returning();
  const ids: string[] = [];
  for (const member of members) {
    const userId = await seedUser(tx, member.token);
    await tx.insert(familyMembers).values({ familyId: family.id, userId, role: member.role });
    ids.push(userId);
  }
  return { familyId: family.id, ids };
}

const tokensOf = async (tx: Executor, userId: string) =>
  (await tx.select().from(deviceTokens).where(eq(deviceTokens.userId, userId))).map((d) => d.token);

describe("reminderSlot (Stockholm time)", () => {
  it("is 16 from 16:00 and 19 from 19:00, each for three hours", () => {
    expect(reminderSlot(new Date("2026-11-13T14:59:00Z"))).toBeNull(); // 15:59
    expect(reminderSlot(new Date("2026-11-13T15:00:00Z"))).toEqual({ key: "reminder:2026-11-13:16", hour: 16 });
    expect(reminderSlot(new Date("2026-11-13T17:59:00Z"))?.hour).toBe(16); // 18:59
    expect(reminderSlot(new Date("2026-11-13T18:00:00Z"))?.hour).toBe(19);
    expect(reminderSlot(new Date("2026-11-13T21:00:00Z"))).toBeNull(); // 22:00
    // Summer time: 16:00 Stockholm is 14:00 UTC.
    expect(reminderSlot(new Date("2026-06-15T14:00:00Z"))).toEqual({ key: "reminder:2026-06-15:16", hour: 16 });
  });
});

describe.skipIf(!hasDevDatabase)("push notifications (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("moves a device to whoever signs in on it, and removes only the user's own token", async () => {
    await inRollback(async (tx) => {
      const token = `tok-${randomUUID()}`;
      const first = await seedUser(tx, token);
      const second = await seedUser(tx);
      await registerDevice(tx, second, token, "android", afternoon);
      expect(await tokensOf(tx, first)).toEqual([]);
      expect(await tokensOf(tx, second)).toEqual([token]);

      await unregisterDevice(tx, first, token);
      expect(await tokensOf(tx, second)).toEqual([token]);
      await unregisterDevice(tx, second, token);
      expect(await tokensOf(tx, second)).toEqual([]);
    });
  });

  it("sends to every device of the users and forgets dead tokens", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx, `ok-${randomUUID()}`);
      await registerDevice(tx, userId, `dead-${randomUUID()}`, "android", afternoon);
      const { sent, send } = fakeSender();
      expect(await notifyUsers(tx, [userId], { title: "t", body: "b" }, afternoon, send)).toEqual({ sent: 1, removed: 1 });
      expect(sent[0].tokens).toHaveLength(2);
      expect(await tokensOf(tx, userId)).toHaveLength(1);
    });
  });

  it("announces a family's temporary chore and combo to the family only", async () => {
    await inRollback(async (tx) => {
      const family = await seedFamily(tx, [
        { role: "parent", token: `p-${randomUUID()}` },
        { role: "child", token: `c-${randomUUID()}` },
      ]);
      const outsider = await seedUser(tx, `o-${randomUUID()}`);
      const [chore] = await tx
        .insert(chores)
        .values({ title: "Kratta löv", points: 50, frequency: "once", isGlobal: false, familyId: family.familyId, expiresAt: new Date("2026-11-20T17:00:00Z") })
        .returning();
      const { sent, send } = fakeSender();
      await announceTemporaryChore(tx, chore.id, afternoon, send);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.data).toEqual({ kind: "temporary_chore", choreId: chore.id });
      const familyTokens = [...(await tokensOf(tx, family.ids[0])), ...(await tokensOf(tx, family.ids[1]))].sort();
      expect(sent[0].tokens).toEqual(familyTokens);
      expect(sent[0].tokens).not.toContain((await tokensOf(tx, outsider))[0]);

      const [combo] = await tx.insert(combos).values({ title: "Kombo", bonusPoints: 20, period: "day", familyId: family.familyId }).returning();
      await announceCombo(tx, combo.id, afternoon, send);
      expect(sent[1].tokens).toEqual(familyTokens);

      // Nothing for an inactive combo or a deadline that already passed.
      await tx.update(combos).set({ isActive: false }).where(eq(combos.id, combo.id));
      await announceCombo(tx, combo.id, afternoon, send);
      await announceTemporaryChore(tx, chore.id, new Date("2026-11-21T00:00:00Z"), send);
      expect(sent).toHaveLength(2);
    });
  });

  it("reminds children and solo users of what is left, once per slot, and never parents", async () => {
    await inRollback(async (tx) => {
      const family = await seedFamily(tx, [
        { role: "parent", token: `p-${randomUUID()}` },
        { role: "child", token: `c-${randomUUID()}` },
      ]);
      const child = family.ids[1];
      // Only this test's chores: switch the global catalog off for the family.
      const globals = await tx.select({ id: chores.id }).from(chores).where(and(isNull(chores.familyId), eq(chores.isActive, true)));
      if (globals.length > 0)
        await tx.insert(choreFamilySettings).values(globals.map((g) => ({ familyId: family.familyId, choreId: g.id, isActive: false })));
      const [a, b] = await tx
        .insert(chores)
        .values([
          { title: "Test A", points: 5, frequency: "daily", isGlobal: false, familyId: family.familyId },
          { title: "Test B", points: 5, frequency: "daily", isGlobal: false, familyId: family.familyId },
        ])
        .returning();
      const [combo] = await tx.insert(combos).values({ title: "Testkombo", bonusPoints: 15, period: "day", familyId: family.familyId }).returning();
      await tx.insert(comboChores).values([
        { comboId: combo.id, choreId: a.id },
        { comboId: combo.id, choreId: b.id },
      ]);
      await completeChore(tx, child, a.id, new Date("2026-11-13T07:00:00Z"));

      const { sent, send } = fakeSender();
      const first = await sendReminders(tx, afternoon, send);
      expect(first.slot).toBe("reminder:2026-11-13:16");
      const childTokens = await tokensOf(tx, child);
      const childMessages = sent.filter((s) => s.tokens.some((t) => childTokens.includes(t)));
      expect(childMessages).toHaveLength(1);
      expect(childMessages[0].message.body).toBe("Kvar idag: Test B.\n🎰 1 syssla kvar till Testkombo (+15).");
      const parentTokens = await tokensOf(tx, family.ids[0]);
      expect(sent.some((s) => s.tokens.some((t) => parentTokens.includes(t)))).toBe(false);

      // A second trigger in the same slot sends nothing new; the 19:00 slot does.
      const count = sent.length;
      await sendReminders(tx, new Date("2026-11-13T16:45:00Z"), send);
      expect(sent.length).toBe(count);
      await sendReminders(tx, new Date("2026-11-13T18:05:00Z"), send);
      expect(sent.filter((s) => s.tokens.some((t) => childTokens.includes(t)))).toHaveLength(2);

      // Between slots nothing is sent at all.
      expect(await sendReminders(tx, new Date("2026-11-13T10:00:00Z"), send)).toEqual({ slot: null, reminded: 0 });
    });
  });
});
