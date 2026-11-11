import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, jwtSigningKey } from "./config";
import { signAccessToken } from "./jwt";
import { hashToken, randomToken } from "./secrets";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type Identity = {
  provider: "google" | "facebook" | "dev";
  providerUserId: string;
  displayName: string;
  email: string | null;
};

type DbOrTx = Pick<typeof db, "insert" | "update" | "select">;

/** Creates the user on first sign-in, refreshes name/email on later ones. */
export async function upsertUser(identity: Identity) {
  const [user] = await db
    .insert(users)
    .values(identity)
    .onConflictDoUpdate({
      target: [users.provider, users.providerUserId],
      set: { displayName: identity.displayName, email: identity.email },
    })
    .returning();
  return user;
}

async function issue(tx: DbOrTx, user: { id: string; role: "user" | "admin" }, chainId: string, now: Date): Promise<TokenPair> {
  const refreshToken = randomToken();
  await tx.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    chainId,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }, jwtSigningKey(), ACCESS_TOKEN_TTL_SECONDS, now),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/**
 * Every sign-in — new or returning user — starts a fresh token chain (business rule 6),
 * so a returning user always gets a valid session.
 */
export function startSession(user: { id: string; role: "user" | "admin" }, now = new Date()): Promise<TokenPair> {
  return issue(db, user, randomUUID(), now);
}

export type RefreshResult =
  | { ok: true; tokens: TokenPair }
  | {
      ok: false;
      code: "invalid_refresh_token" | "refresh_token_expired" | "refresh_token_reused" | "session_revoked";
    };

/**
 * Rotates a refresh token. A token that was already used or revoked indicates theft or a replay,
 * so the whole chain is revoked and the user must sign in again.
 */
export async function rotateRefreshToken(presented: string, now = new Date()): Promise<RefreshResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: refreshTokens.id,
        chainId: refreshTokens.chainId,
        expiresAt: refreshTokens.expiresAt,
        usedAt: refreshTokens.usedAt,
        revokedAt: refreshTokens.revokedAt,
        userId: users.id,
        role: users.role,
      })
      .from(refreshTokens)
      .innerJoin(users, eq(users.id, refreshTokens.userId))
      .where(eq(refreshTokens.tokenHash, hashToken(presented)))
      .for("update", { of: refreshTokens });

    if (!row) return { ok: false, code: "invalid_refresh_token" } as const;

    if (row.usedAt) {
      // Already rotated once: someone is replaying it. Kill every token in the chain.
      await revokeChainWith(tx, row.chainId, now);
      return { ok: false, code: "refresh_token_reused" } as const;
    }
    if (row.revokedAt) return { ok: false, code: "session_revoked" } as const;
    if (row.expiresAt <= now) return { ok: false, code: "refresh_token_expired" } as const;

    await tx.update(refreshTokens).set({ usedAt: now }).where(eq(refreshTokens.id, row.id));
    const tokens = await issue(tx, { id: row.userId, role: row.role }, row.chainId, now);
    return { ok: true, tokens } as const;
  });
}

/** Logout: revokes the chain the presented token belongs to. Unknown tokens are ignored. */
export async function revokeSession(presented: string, now = new Date()): Promise<void> {
  const [row] = await db
    .select({ chainId: refreshTokens.chainId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(presented)));
  if (row) await revokeChainWith(db, row.chainId, now);
}

async function revokeChainWith(tx: DbOrTx, chainId: string, now: Date) {
  await tx
    .update(refreshTokens)
    .set({ revokedAt: sql`coalesce(${refreshTokens.revokedAt}, ${now})` })
    .where(and(eq(refreshTokens.chainId, chainId), isNull(refreshTokens.revokedAt)));
}
