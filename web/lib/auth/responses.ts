import { NextResponse } from "next/server";
import { APP_CALLBACK_URL } from "./config";
import type { TokenPair } from "./session";

/** OAuth-style token body (snake_case), shared by /refresh and /dev. */
export const tokenBody = (t: TokenPair) => ({
  access_token: t.accessToken,
  refresh_token: t.refreshToken,
  token_type: "Bearer",
  expires_in: t.expiresIn,
});

/**
 * Hands the result back to the app's WebAuthenticator. Tokens go in the fragment so they are never
 * sent to a server or written to access logs.
 */
export function appRedirect(fragment: Record<string, string>) {
  const url = `${APP_CALLBACK_URL}#${new URLSearchParams(fragment).toString()}`;
  return new NextResponse(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
}
