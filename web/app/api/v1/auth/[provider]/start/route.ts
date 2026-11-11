import { NextResponse } from "next/server";
import { jwtSigningKey, publicOrigin } from "@/lib/auth/config";
import { STATE_COOKIE, STATE_TTL_SECONDS, isAuthClient, sealState } from "@/lib/auth/oauth-state";
import { isProvider, ProviderNotConfiguredError, providers } from "@/lib/auth/providers";
import { randomToken } from "@/lib/auth/secrets";
import { apiError } from "@/lib/http";

// Opened by the app's WebAuthenticator (or the admin login page with ?client=admin); redirects the
// browser to the provider's consent screen.
export async function GET(request: Request, ctx: RouteContext<"/api/v1/auth/[provider]/start">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return apiError(404, "unknown_provider", `Unknown provider: ${provider}`);
  const requested = new URL(request.url).searchParams.get("client");
  const client = isAuthClient(requested) ? requested : "app";

  const origin = publicOrigin(request);
  const state = randomToken();
  const redirectUri = `${origin}/api/v1/auth/${provider}/callback`;

  let authorizeUrl: string;
  try {
    authorizeUrl = providers[provider].authorizeUrl({ redirectUri, state });
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError)
      return apiError(503, "provider_not_configured", `Sign-in with ${provider} is not available in this environment`);
    throw error;
  }

  const response = NextResponse.redirect(authorizeUrl, 302);
  response.cookies.set(STATE_COOKIE, sealState({ state, provider, client }, jwtSigningKey(), new Date()), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax", // the provider's redirect back is a top-level GET, which lax allows
    path: "/api/v1/auth",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
