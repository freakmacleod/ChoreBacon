import { seal, unseal } from "./seal";

// CSRF protection for the OAuth round trip: /start sets a signed, short-lived cookie holding the
// state value; /callback accepts the provider's response only if its `state` matches the cookie.
// The cookie also remembers who started the sign-in: the app (tokens via chorebacon://auth) or the
// admin web pages (session cookie).

export const STATE_COOKIE = "cb_oauth_state";
export const STATE_TTL_SECONDS = 10 * 60;
const PURPOSE = "oauth-state";

export type AuthClient = "app" | "admin";
export const isAuthClient = (value: string | null): value is AuthClient => value === "app" || value === "admin";

type StatePayload = { state: string; provider: string; client: AuthClient };

export function sealState(payload: StatePayload, key: string, now: Date): string {
  return seal(PURPOSE, payload, STATE_TTL_SECONDS, key, now);
}

/** The client that started the sign-in, if the cookie is authentic, unexpired, for this provider and carries this state. */
export function readState(
  cookie: string | undefined,
  expected: { state: string | null; provider: string },
  key: string,
  now: Date,
): AuthClient | null {
  if (!expected.state) return null;
  const payload = unseal<StatePayload>(PURPOSE, cookie, key, now);
  if (!payload || payload.provider !== expected.provider || payload.state !== expected.state) return null;
  return isAuthClient(payload.client) ? payload.client : null;
}
