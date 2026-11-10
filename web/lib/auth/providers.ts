import { createHmac } from "node:crypto";
import { z } from "zod";

export type ProviderId = "google" | "facebook";
export const PROVIDERS: readonly ProviderId[] = ["google", "facebook"];
export const isProvider = (value: string): value is ProviderId => (PROVIDERS as readonly string[]).includes(value);

export type ProviderProfile = { providerUserId: string; displayName: string; email: string | null };

type Provider = {
  authorizeUrl(params: { redirectUri: string; state: string }): string;
  /** Exchanges the authorization code and returns the signed-in user's profile. */
  fetchProfile(params: { code: string; redirectUri: string }): Promise<ProviderProfile>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) throw new Error(`${new URL(url).host} responded ${response.status}`);
  return schema.parse(await response.json());
}

// ── Google (OpenID Connect) ──────────────────────────────────────────────────

const google: Provider = {
  authorizeUrl({ redirectUri, state }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();
    return url.toString();
  },
  async fetchProfile({ code, redirectUri }) {
    const token = await fetchJson("https://oauth2.googleapis.com/token", z.object({ access_token: z.string() }), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    // Userinfo over TLS straight from Google, so no ID-token signature verification is needed.
    const info = await fetchJson(
      "https://openidconnect.googleapis.com/v1/userinfo",
      z.object({ sub: z.string(), name: z.string().optional(), email: z.string().optional(), email_verified: z.boolean().optional() }),
      { headers: { authorization: `Bearer ${token.access_token}` } },
    );
    return {
      providerUserId: info.sub,
      displayName: info.name ?? info.email ?? "Google-användare",
      email: info.email && info.email_verified ? info.email : null,
    };
  },
};

// ── Facebook Login ───────────────────────────────────────────────────────────

const facebook: Provider = {
  authorizeUrl({ redirectUri, state }) {
    const url = new URL("https://www.facebook.com/dialog/oauth");
    url.search = new URLSearchParams({
      client_id: requireEnv("FACEBOOK_APP_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state,
    }).toString();
    return url.toString();
  },
  async fetchProfile({ code, redirectUri }) {
    const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
    tokenUrl.search = new URLSearchParams({
      client_id: requireEnv("FACEBOOK_APP_ID"),
      client_secret: requireEnv("FACEBOOK_APP_SECRET"),
      redirect_uri: redirectUri,
      code,
    }).toString();
    const token = await fetchJson(tokenUrl.toString(), z.object({ access_token: z.string() }));

    const meUrl = new URL("https://graph.facebook.com/me");
    meUrl.search = new URLSearchParams({
      fields: "id,name,email",
      access_token: token.access_token,
      appsecret_proof: createHmac("sha256", requireEnv("FACEBOOK_APP_SECRET")).update(token.access_token).digest("hex"),
    }).toString();
    const me = await fetchJson(meUrl.toString(), z.object({ id: z.string(), name: z.string().optional(), email: z.string().optional() }));
    // Facebook only returns email if the user granted it and it is confirmed.
    return { providerUserId: me.id, displayName: me.name ?? "Facebook-användare", email: me.email ?? null };
  },
};

export const providers: Record<ProviderId, Provider> = { google, facebook };
