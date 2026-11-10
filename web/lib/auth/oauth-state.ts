import { createHmac, timingSafeEqual } from "node:crypto";

// CSRF protection for the OAuth round trip: /start sets a signed, short-lived cookie holding the
// state value; /callback accepts the provider's response only if its `state` matches the cookie.

export const STATE_COOKIE = "cb_oauth_state";
export const STATE_TTL_SECONDS = 10 * 60;

type StatePayload = { state: string; provider: string; exp: number };

const mac = (data: string, key: string) => createHmac("sha256", key).update(`oauth-state:${data}`).digest("base64url");

export function sealState(payload: Omit<StatePayload, "exp">, key: string, now: Date): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(now.getTime() / 1000) + STATE_TTL_SECONDS }),
  ).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

/** True only if the cookie is authentic, unexpired, for this provider, and carries this state. */
export function verifyState(
  cookie: string | undefined,
  expected: { state: string | null; provider: string },
  key: string,
  now: Date,
): boolean {
  if (!cookie || !expected.state) return false;
  const [body, signature] = cookie.split(".");
  if (!body || !signature) return false;

  const good = Buffer.from(mac(body, key));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return false;

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  return (
    payload.provider === expected.provider &&
    payload.state === expected.state &&
    payload.exp > Math.floor(now.getTime() / 1000)
  );
}
