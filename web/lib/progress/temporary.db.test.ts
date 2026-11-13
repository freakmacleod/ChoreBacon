import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { chores, families, familyMembers, users } from "../../db/schema";
import { reviewCompletion, updateFamilyChore } from "../family/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import { completeChore, listChores } from "./service";

// Monday 9 Nov 2026, 10:00 Stockholm; the deadline is Friday 18:00 Stockholm.
const monday = new Date("2026-11-09T09:00:00Z");
const deadline = new Date("2026-11-13T17:00:00Z");

async function seedUser(tx: Executor) {
  const [user] = await tx
    .insert(users)
    .values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: "Test" })
    .returning();
  return user.id;
}

async function seedFamily(tx: Executor, requiresApproval: boolean, roles: ("parent" | "child")[]) {
  const [family] = await tx.insert(families).values({ name: "Test", requiresApproval, inviteCode: randomUUID().slice(0, 8) }).returning();
  const members: string[] = [];
  for (const role of roles) {
    const userId = await seedUser(tx);
    await tx.insert(familyMembers).values({ familyId: family.id, userId, role });
    members.push(userId);
  }
  return { familyId: family.id, members };
}

async function seedTemporary(tx: Executor, familyId: string | null, expiresAt = deadline) {
  const [chore] = await tx
    .insert(chores)
    .values({ title: "Kratta löv", points: 50, frequency: "once", isGlobal: familyId === null, familyId, expiresAt })
    .returning();
  return chore.id;
}

const listed = async (tx: Executor, userId: string, at: Date) => (await listChores(tx, userId, at)).map((c) => c.id);

describe.skipIf(!hasDevDatabase)("temporary chores (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("is shown first until its deadline, then disappears and can no longer be done", async () => {
    await inRollback(async (tx) => {
      const userId = await seedUser(tx);
      const choreId = await seedTemporary(tx, null);

      const list = await listChores(tx, userId, monday);
      expect(list[0]).toMatchObject({ id: choreId, expiresAt: deadline, frequency: "once" });
      expect(await listed(tx, userId, new Date(deadline.getTime() - 1))).toContain(choreId);
      expect(await listed(tx, userId, deadline)).not.toContain(choreId);
      expect(await completeChore(tx, userId, choreId, deadline)).toMatchObject({ ok: false, status: 409, code: "chore_expired" });
    });
  });

  it("goes to the first one in the family; the others no longer see it", async () => {
    await inRollback(async (tx) => {
      const { familyId, members } = await seedFamily(tx, false, ["parent", "child", "child"]);
      const [, first, second] = members;
      const choreId = await seedTemporary(tx, familyId);

      expect(await completeChore(tx, first, choreId, monday)).toMatchObject({ ok: true, pointsEarned: 50 });
      expect((await listChores(tx, first, monday)).find((c) => c.id === choreId)).toMatchObject({ completedThisPeriod: true });
      expect(await listed(tx, second, monday)).not.toContain(choreId);
      expect(await completeChore(tx, second, choreId, monday)).toMatchObject({ ok: false, status: 409, code: "chore_taken" });
    });
  });

  it("is free again for the others when a parent rejects the first one's completion", async () => {
    await inRollback(async (tx) => {
      const { familyId, members } = await seedFamily(tx, true, ["parent", "child", "child"]);
      const [parent, first, second] = members;
      const choreId = await seedTemporary(tx, familyId);

      const pending = await completeChore(tx, first, choreId, monday);
      expect(pending).toMatchObject({ ok: true, pointsPending: 50 });
      // Waiting for approval already counts as taken.
      expect(await listed(tx, second, monday)).not.toContain(choreId);

      await reviewCompletion(tx, parent, pending.ok ? pending.completion.id : "", false, monday);
      expect(await listed(tx, second, monday)).toContain(choreId);
      expect(await completeChore(tx, second, choreId, monday)).toMatchObject({ ok: true });
    });
  });

  it("works per family for a global temporary chore, and only once for a solo user", async () => {
    await inRollback(async (tx) => {
      const a = await seedFamily(tx, false, ["child"]);
      const b = await seedFamily(tx, false, ["child"]);
      const solo = await seedUser(tx);
      const choreId = await seedTemporary(tx, null);

      expect(await completeChore(tx, a.members[0], choreId, monday)).toMatchObject({ ok: true });
      expect(await completeChore(tx, b.members[0], choreId, monday)).toMatchObject({ ok: true });
      expect(await completeChore(tx, solo, choreId, monday)).toMatchObject({ ok: true });
      expect(await completeChore(tx, solo, choreId, monday)).toMatchObject({ ok: false, code: "chore_already_completed" });
    });
  });

  it("stays a one-off when a parent edits it in the app", async () => {
    await inRollback(async (tx) => {
      const { familyId, members } = await seedFamily(tx, false, ["parent"]);
      const choreId = await seedTemporary(tx, familyId);
      const edit = { title: "Kratta löv", description: "", icon: "leaves", points: 60, frequency: "daily" as const, isActive: true };
      expect(await updateFamilyChore(tx, members[0], choreId, edit)).toMatchObject({ ok: true });
      const [row] = await tx.select().from(chores).where(eq(chores.id, choreId));
      expect(row).toMatchObject({ points: 60, frequency: "once", expiresAt: deadline });
    });
  });
});
