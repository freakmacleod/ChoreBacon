import { seal, unseal } from "./seal";

// The admin web pages use a signed HttpOnly cookie instead of the app's bearer tokens. It only names
// the user; the admin role is checked against the database on every request, so removing someone's
// admin role takes effect immediately.

export const ADMIN_COOKIE = "cb_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const PURPOSE = "admin-session";

export const sealAdminSession = (userId: string, key: string, now: Date) =>
  seal(PURPOSE, { sub: userId }, ADMIN_SESSION_TTL_SECONDS, key, now);

export const readAdminSession = (cookie: string | undefined, key: string, now: Date): string | null =>
  unseal<{ sub: string }>(PURPOSE, cookie, key, now)?.sub ?? null;

export const adminCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const, // the redirect back from the provider is a top-level GET
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
});
