import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { chores, families, rewards, users } from "../../db/schema";
import * as family from "../family/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import { listUsers } from "./catalog";
import * as admin from "./families";
import { getFamilyDetail, listFamilies } from "./families";

async function seedUser(tx: Executor, name: string) {
  const [user] = await tx.insert(users).values({ provider: "dev", providerUserId: `test-${randomUUID()}`, displayName: name }).returning();
  return user.id;
}

describe.skipIf(!hasDevDatabase)("admin view of families (development database, rolled back)", { timeout: 30_000 }, () => {
  afterAll(closeDevDatabase);

  it("shows who is in which family and what each family changed or added", async () => {
    await inRollback(async (tx) => {
      const parent = await seedUser(tx, "Förälder Test");
      const child = await seedUser(tx, "Barn Test");
      const solo = await seedUser(tx, "Solo Test");
      const created = await family.createFamily(tx, parent, "Familjen Test");
      if (!created.ok) throw new Error("create failed");
      const [{ inviteCode }] = await tx.select({ inviteCode: families.inviteCode }).from(families).where(eq(families.id, created.familyId));
      await family.joinFamily(tx, child, inviteCode);

      const [globalChore] = await tx.insert(chores).values({ title: "Test global", points: 10, frequency: "daily", isGlobal: true }).returning();
      const [globalReward] = await tx.insert(rewards).values({ title: "Test reward", cost: 50 }).returning();
      await family.setChoreSettings(tx, parent, globalChore.id, { isActive: false, pointsOverride: null });
      await family.setRewardSettings(tx, parent, globalReward.id, { isActive: true, costOverride: 30, stock: 2 });
      await family.createFamilyChore(tx, parent, { title: "Rasta hunden", description: "", icon: "pet", points: 15, frequency: "daily", isActive: true });

      const listed = (await listFamilies(tx)).find((f) => f.id === created.familyId);
      expect(listed).toMatchObject({ name: "Familjen Test", members: 2, parents: "Förälder Test", ownChores: 1, ownRewards: 0, changes: 2 });

      const detail = await getFamilyDetail(tx, created.familyId);
      expect(detail?.members.map((m) => [m.displayName, m.role])).toEqual([
        ["Förälder Test", "parent"],
        ["Barn Test", "child"],
      ]);
      expect(detail?.ownChores.map((c) => c.title)).toEqual(["Rasta hunden"]);
      expect(detail?.choreChanges).toEqual([expect.objectContaining({ title: "Test global", isActive: false, pointsOverride: null })]);
      expect(detail?.rewardChanges).toEqual([expect.objectContaining({ title: "Test reward", catalogCost: 50, costOverride: 30, stock: 2 })]);
      expect(await getFamilyDetail(tx, randomUUID())).toBeNull();

      const userRows = await listUsers(tx);
      expect(userRows.find((u) => u.id === child)).toMatchObject({ familyId: created.familyId, familyName: "Familjen Test", familyRole: "child" });
      expect(userRows.find((u) => u.id === solo)).toMatchObject({ familyId: null, familyName: null });
    });
  });

  it("lets the admin create a family and place users in it", async () => {
    await inRollback(async (tx) => {
      const parent = await seedUser(tx, "Admin Förälder");
      const child = await seedUser(tx, "Admin Barn");
      const familyId = await admin.createFamily(tx, { name: "Adminfamiljen", requiresApproval: true });

      const detail = await getFamilyDetail(tx, familyId);
      expect(detail?.family).toMatchObject({ name: "Adminfamiljen", requiresApproval: true });
      expect(detail?.family.inviteCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      expect(await admin.addMember(tx, familyId, parent, "parent")).toEqual({ ok: true });
      expect(await admin.addMember(tx, familyId, child, "child")).toEqual({ ok: true });
      const free = (await admin.usersWithoutFamily(tx)).map((u) => u.id);
      expect(free).not.toContain(parent);
      expect(free).not.toContain(child);

      // The member sees the family in the app exactly as if they had created or joined it.
      const seen = await family.getFamily(tx, parent);
      expect(seen).toMatchObject({ ok: true, family: { name: "Adminfamiljen", role: "parent" } });

      expect(await admin.updateFamily(tx, familyId, { name: "Nytt namn", requiresApproval: false })).toBe(true);
      expect((await getFamilyDetail(tx, familyId))?.family).toMatchObject({ name: "Nytt namn", requiresApproval: false });
      expect(await admin.updateFamily(tx, randomUUID(), { name: "x", requiresApproval: false })).toBe(false);
    });
  });

  it("keeps one family per user and refuses unknown or deleted users", async () => {
    await inRollback(async (tx) => {
      const user = await seedUser(tx, "Upptagen");
      const deleted = await seedUser(tx, "Raderad");
      await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted));
      const first = await admin.createFamily(tx, { name: "Första", requiresApproval: false });
      const second = await admin.createFamily(tx, { name: "Andra", requiresApproval: false });

      await admin.addMember(tx, first, user, "parent");
      expect(await admin.addMember(tx, second, user, "child")).toEqual({ ok: false, reason: "already_in_family" });
      expect(await admin.addMember(tx, second, deleted, "child")).toEqual({ ok: false, reason: "user_not_found" });
      expect(await admin.addMember(tx, second, randomUUID(), "child")).toEqual({ ok: false, reason: "user_not_found" });
      expect(await admin.addMember(tx, randomUUID(), user, "child")).toEqual({ ok: false, reason: "not_found" });
      expect((await admin.usersWithoutFamily(tx)).map((u) => u.id)).not.toContain(deleted);
    });
  });

  it("never leaves a family with members but no parent", async () => {
    await inRollback(async (tx) => {
      const parent = await seedUser(tx, "Ensam förälder");
      const child = await seedUser(tx, "Barnet");
      const familyId = await admin.createFamily(tx, { name: "Familjen Regel", requiresApproval: false });
      await admin.addMember(tx, familyId, parent, "parent");
      await admin.addMember(tx, familyId, child, "child");

      expect(await admin.setMemberRole(tx, familyId, parent, "child")).toEqual({ ok: false, reason: "last_parent" });
      expect(await admin.removeMember(tx, familyId, parent)).toEqual({ ok: false, reason: "last_parent" });

      // Promote the child first; then the old parent can step down or leave.
      expect(await admin.setMemberRole(tx, familyId, child, "parent")).toEqual({ ok: true });
      expect(await admin.setMemberRole(tx, familyId, parent, "child")).toEqual({ ok: true });
      expect(await admin.removeMember(tx, familyId, parent)).toEqual({ ok: true });
      expect((await admin.usersWithoutFamily(tx)).map((u) => u.id)).toContain(parent);

      // The last member may leave: an empty family is allowed and can be filled again.
      expect(await admin.removeMember(tx, familyId, child)).toEqual({ ok: true });
      expect(await admin.removeMember(tx, familyId, child)).toEqual({ ok: false, reason: "not_found" });
      expect(await admin.addMember(tx, familyId, child, "parent")).toEqual({ ok: true });
    });
  });
});
