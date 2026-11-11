import { createHmac, timingSafeEqual } from "node:crypto";

// Signed (not encrypted) short-lived tokens for cookies: base64url(JSON payload + exp) "." HMAC.
// The purpose is part of the MAC, so a token sealed for one use (OAuth state) is never accepted
// for another (admin session) even though both use JWT_SIGNING_KEY.

const mac = (purpose: string, body: string, key: string) =>
  createHmac("sha256", key).update(`${purpose}:${body}`).digest("base64url");

export function seal(purpose: string, payload: Record<string, unknown>, ttlSeconds: number, key: string, now: Date): string {
  const exp = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  return `${body}.${mac(purpose, body, key)}`;
}

/** The payload if the token is authentic, for this purpose, and unexpired; otherwise null. */
export function unseal<T extends object>(purpose: string, token: string | undefined, key: string, now: Date): T | null {
  const [body, signature, extra] = token?.split(".") ?? [];
  if (!body || !signature || extra !== undefined) return null;

  const good = Buffer.from(mac(purpose, body, key));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return typeof payload.exp === "number" && payload.exp > Math.floor(now.getTime() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
