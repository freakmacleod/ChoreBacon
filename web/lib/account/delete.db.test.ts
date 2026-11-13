import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { chores, deviceTokens, families, familyMembers, pointLedger, refreshTokens, users } from "../../db/schema";
import { findAdmin } from "../admin/catalog";
import { startSessionWith, upsertUserWith } from "../test/auth-helpers";
import { createFamily, joinFamily, updateFamily } from "../family/service";
import { completeChore, loadStats } from "../progress/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import { DELETED_NAME, deleteAccount } from "./delete";
import { findDeletion, newConfirmationCode, recordDeletion } from "./receipts";

const now = new Date("2026-11-12T09:00:00Z");

async function seedUser(tx: Executor, role: "user" | "admin" = "user") {
  const identity = { provider: "facebook" as const, providerUserId: `test-${randomUUID()}`, displayName: "Anna", email: "anna@example.se" };
  const [user] = await tx.insert(users).values({ ...identity, role }).returning();
  return { id: user.id, identity };
}

describe.skipIf(!hasDevDatabase)("account deletion (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("anonymises the user, ends sessions and keeps the ledger consistent", async () => {
    await inRollback(async (tx) => {
      const { id, identity } = await seedUser(tx, "admin");
      await tx.insert(pointLedger).values({ userId: id, delta: 50, reason: "admin_adjustment" });
      await startSessionWith(tx, id);
      await tx.insert(deviceTokens).values({ token: `tok-${id}`, userId: id, platform: "android" });

      expect(await deleteAccount(tx, id, now)).toEqual({ ok: true });

      const [row] = await tx.select().from(users).where(eq(users.id, id));
      expect(row).toMatchObject({ displayName: DELETED_NAME, email: null, role: "user", deletedAt: now });
      expect(row.providerUserId).not.toBe(identity.providerUserId);
      expect(await tx.select().from(refreshTokens).where(eq(refreshTokens.userId, id))).toEqual([]);
      expect(await tx.select().from(deviceTokens).where(eq(deviceTokens.userId, id))).toEqual([]); // no more notifications
      expect((await loadStats(tx, id, now)).balance).toBe(50); // history intact, just anonymous
      expect(await findAdmin(tx, id)).toBeNull();

      // Writes with a still-valid access token are refused…
      const [chore] = await tx.insert(chores).values({ title: "Test", points: 5, frequency: "daily", isGlobal: true }).returning();
      expect(await completeChore(tx, id, chore.id, now)).toMatchObject({ status: 404, code: "user_not_found" });
      // …and signing in again with the same Facebook account starts a new, empty account.
      const again = await upsertUserWith(tx, identity);
      expect(again.id).not.toBe(id);
      expect(await deleteAccount(tx, id, now)).toMatchObject({ status: 404 });
    });
  });

  it("asks the last parent to hand over first, unless forced (Facebook's callback)", async () => {
    await inRollback(async (tx) => {
      const parent = await seedUser(tx);
      const child = await seedUser(tx);
      const created = await createFamily(tx, parent.id, "Testfamiljen");
      if (!created.ok) throw new Error("create failed");
      const [{ inviteCode }] = await tx.select({ inviteCode: families.inviteCode }).from(families).where(eq(families.id, created.familyId));
      await joinFamily(tx, child.id, inviteCode);
      await updateFamily(tx, parent.id, { requiresApproval: true });

      expect(await deleteAccount(tx, parent.id, now)).toMatchObject({ status: 409, code: "last_parent" });

      expect(await deleteAccount(tx, parent.id, now, { force: true })).toEqual({ ok: true });
      const members = await tx.select().from(familyMembers).where(eq(familyMembers.familyId, created.familyId));
      expect(members.map((m) => m.userId)).toEqual([child.id]);
      const [family] = await tx.select().from(families).where(eq(families.id, created.familyId));
      expect(family.requiresApproval).toBe(false); // nobody left to approve
    });
  });

  it("lets a child or a solo user delete without conditions", async () => {
    await inRollback(async (tx) => {
      const solo = await seedUser(tx);
      expect(await deleteAccount(tx, solo.id, now)).toEqual({ ok: true });
    });
  });

  it("keeps a receipt per confirmation code, without personal data", async () => {
    await inRollback(async (tx) => {
      const code = newConfirmationCode();
      await recordDeletion(tx, code, now);
      expect(await findDeletion(tx, code.toLowerCase())).toMatchObject({ code, completedAt: now });
      expect(await findDeletion(tx, "NOPE")).toBeNull();
    });
  });
});
