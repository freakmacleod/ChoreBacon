import { randomUUID } from "node:crypto";
import type { Executor } from "../../db/executor";
import { refreshTokens, users } from "../../db/schema";
import { hashToken, randomToken } from "../auth/secrets";

// Test-only versions of the session helpers that take an executor (the real ones use the app's db).

export async function startSessionWith(tx: Executor, userId: string) {
  await tx.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(randomToken()),
    chainId: randomUUID(),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}

/** Same conflict rule as upsertUser: one row per (provider, provider_user_id). */
export async function upsertUserWith(
  tx: Executor,
  identity: { provider: "google" | "facebook" | "dev"; providerUserId: string; displayName: string; email: string | null },
) {
  const [user] = await tx
    .insert(users)
    .values(identity)
    .onConflictDoUpdate({ target: [users.provider, users.providerUserId], set: { displayName: identity.displayName } })
    .returning();
  return user;
}
