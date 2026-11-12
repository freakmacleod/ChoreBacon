import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Executor } from "../../db/executor";
import { chores, families, rewards, users } from "../../db/schema";
import * as family from "../family/service";
import { closeDevDatabase, hasDevDatabase, inRollback } from "../test/dev-db";
import { listUsers } from "./catalog";
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
});
