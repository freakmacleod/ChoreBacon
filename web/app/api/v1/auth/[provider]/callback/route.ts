import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, sealAdminSession } from "@/lib/auth/admin-session";
import { jwtSigningKey, publicOrigin } from "@/lib/auth/config";
import { STATE_COOKIE, readState } from "@/lib/auth/oauth-state";
import { type ProviderId, isProvider, providers } from "@/lib/auth/providers";
import { adminLoginRedirect, appRedirect } from "@/lib/auth/responses";
import { startSession, upsertUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

// The provider redirects here. The app receives its own tokens via chorebacon://auth; the admin web
// pages get a session cookie, and only users with role admin get one.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return apiError(404, "unknown_provider", `Unknown provider: ${provider}`);

  const response = await complete(request, provider);
  // Single-use: the state cookie is cleared whatever the outcome.
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/v1/auth" });
  return response;
}

async function complete(request: NextRequest, provider: ProviderId) {
  const params = request.nextUrl.searchParams;
  const origin = publicOrigin(request);
  const client = readState(
    request.cookies.get(STATE_COOKIE)?.value,
    { state: params.get("state"), provider },
    jwtSigningKey(),
    new Date(),
  );
  // Without a valid state we cannot know who asked, so the app (the main client) gets the error.
  if (!client) return appRedirect({ error: "invalid_state" });

  const fail = (error: string) => (client === "admin" ? adminLoginRedirect(origin, error) : appRedirect({ error }));
  // The user pressed cancel / denied consent on the provider's page.
  if (params.has("error")) return fail("access_denied");
  const code = params.get("code");
  if (!code) return fail("missing_code");

  try {
    const redirectUri = `${origin}/api/v1/auth/${provider}/callback`;
    const profile = await providers[provider].fetchProfile({ code, redirectUri });
    const user = await upsertUser({ provider, ...profile });
    return client === "admin" ? adminSignIn(origin, user) : await appSignIn(user);
  } catch (error) {
    console.error(`OAuth callback failed for ${provider}`, error);
    return fail("provider_error");
  }
}

async function appSignIn(user: { id: string; role: "user" | "admin" }) {
  const tokens = await startSession(user);
  return appRedirect({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_in: String(tokens.expiresIn),
  });
}

function adminSignIn(origin: string, user: { id: string; role: "user" | "admin" }) {
  if (user.role !== "admin") return adminLoginRedirect(origin, "not_admin");
  const response = NextResponse.redirect(`${origin}/admin`, 302);
  response.cookies.set(ADMIN_COOKIE, sealAdminSession(user.id, jwtSigningKey(), new Date()), adminCookieOptions(origin.startsWith("https://")));
  return response;
}
