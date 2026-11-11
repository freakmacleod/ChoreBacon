import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal HS256 JWT for our own access tokens. We are both issuer and only verifier, so a shared
// secret (JWT_SIGNING_KEY) is enough and avoids a JOSE dependency.

export const ISSUER = "chorebacon";
export const AUDIENCE = "chorebacon-app";

export type AccessClaims = {
  sub: string;
  role: "user" | "admin";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");
const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function sign(input: string, key: string) {
  return createHmac("sha256", key).update(input).digest();
}

export function signAccessToken(
  claims: Pick<AccessClaims, "sub" | "role">,
  key: string,
  ttlSeconds: number,
  now: Date,
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const payload: AccessClaims = { ...claims, iss: ISSUER, aud: AUDIENCE, iat, exp: iat + ttlSeconds };
  const body = `${HEADER}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${b64url(sign(body, key))}`;
}

/** Returns the claims if signature, issuer, audience and expiry are valid; otherwise null. */
export function verifyAccessToken(token: string, key: string, now: Date): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return null;

  const expected = sign(`${parts[0]}.${parts[1]}`, key);
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE) return null;
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(now.getTime() / 1000)) return null;
  return claims;
}
