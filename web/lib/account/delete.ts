import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { deviceTokens, families, familyMembers, refreshTokens, users } from "../../db/schema";

// Account deletion (GDPR erasure) by anonymisation: the user row stays so the append-only ledger,
// completions and redemptions remain consistent, but nothing in it points at the person any more.
// Signing in again with the same Google/Facebook account creates a new, empty account.

export const DELETED_NAME = "Raderad användare";

export type DeleteResult = { ok: true } | { ok: false; status: 404 | 409; code: string; message: string };

/**
 * Anonymises the account, revokes its sessions and removes it from its family.
 *
 * A family's last parent is asked to hand over first (409 last_parent) — unless `force` is set, as for
 * Facebook's deletion callback, which cannot be refused. Then the family keeps going without a parent,
 * so approval is switched off to avoid children's chores waiting forever.
 */
export async function deleteAccount(exec: Executor, userId: string, now: Date, { force = false } = {}): Promise<DeleteResult> {
  return exec.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .for("update");
    if (!user) return { ok: false, status: 404, code: "user_not_found", message: "No such account" };

    const [membership] = await tx
      .select({ familyId: familyMembers.familyId, role: familyMembers.role })
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));
    if (membership?.role === "parent") {
      const others = await tx
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, membership.familyId), ne(familyMembers.userId, userId)))
        .for("update");
      if (others.length > 0 && !others.some((m) => m.role === "parent")) {
        if (!force) return { ok: false, status: 409, code: "last_parent", message: "Make someone else a parent first" };
        await tx.update(families).set({ requiresApproval: false }).where(eq(families.id, membership.familyId));
      }
    }

    await tx.delete(familyMembers).where(eq(familyMembers.userId, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
    await tx
      .update(users)
      .set({
        displayName: DELETED_NAME,
        email: null,
        // Unique per deleted account and never a real provider id, so a new sign-in makes a new user.
        providerUserId: `deleted:${randomUUID()}`,
        role: "user",
        deletedAt: now,
      })
      .where(eq(users.id, userId));
    return { ok: true };
  });
}
