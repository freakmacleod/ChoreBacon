import type { NextRequest } from "next/server";
import { jwtSigningKey, publicOrigin } from "@/lib/auth/config";
import { STATE_COOKIE, verifyState } from "@/lib/auth/oauth-state";
import { type ProviderId, isProvider, providers } from "@/lib/auth/providers";
import { appRedirect } from "@/lib/auth/responses";
import { startSession, upsertUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

// The provider redirects here; on success the app receives its own tokens via chorebacon://auth.
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
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;

  if (!verifyState(stateCookie, { state: params.get("state"), provider }, jwtSigningKey(), new Date())) {
    return appRedirect({ error: "invalid_state" });
  }
  // The user pressed cancel / denied consent on the provider's page.
  if (params.has("error")) return appRedirect({ error: "access_denied" });

  const code = params.get("code");
  if (!code) return appRedirect({ error: "missing_code" });

  try {
    const redirectUri = `${publicOrigin(request)}/api/v1/auth/${provider}/callback`;
    const profile = await providers[provider].fetchProfile({ code, redirectUri });
    const user = await upsertUser({ provider, ...profile });
    const tokens = await startSession(user);
    return appRedirect({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: String(tokens.expiresIn),
    });
  } catch (error) {
    console.error(`OAuth callback failed for ${provider}`, error);
    return appRedirect({ error: "provider_error" });
  }
}
