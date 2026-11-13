import { createSign } from "node:crypto";

// Firebase Cloud Messaging over its HTTP v1 API, without the Firebase Admin SDK: a service account's
// key signs a short-lived JWT, Google exchanges it for an OAuth access token, and that token sends the
// messages. Configured with FIREBASE_SERVICE_ACCOUNT (the service account's JSON key, as one line); when
// it is missing, push is simply off and nothing is sent.

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };
export type PushMessage = { title: string; body: string; data?: Record<string, string> };
/** "invalid_token" means the device is gone (app uninstalled, token rotated): remove the token. */
export type SendResult = "sent" | "invalid_token" | "failed";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** The Android notification channel the app creates (Platforms/Android/MainApplication.cs). */
export const ANDROID_CHANNEL = "chorebacon_default";

export function serviceAccount(env: string | undefined = process.env.FIREBASE_SERVICE_ACCOUNT): ServiceAccount | null {
  if (!env) return null;
  const parsed = JSON.parse(env) as Partial<ServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key)
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be a service account JSON key");
  return parsed as ServiceAccount;
}

/** The signed JWT that Google's token endpoint exchanges for an access token (RS256, valid one hour). */
export function signedAssertion(account: ServiceAccount, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  return `${unsigned}.${signature}`;
}

/** The FCM v1 request body for one device. High priority so it shows promptly; data values must be strings. */
export function fcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: message.data ?? {},
      android: { priority: "high", notification: { channel_id: ANDROID_CHANNEL } },
    },
  };
}

/** FCM's answer for one message: 404 UNREGISTERED or a 400 about the token means the token is dead. */
export async function classifyResponse(response: Response): Promise<SendResult> {
  if (response.ok) return "sent";
  if (response.status === 404) return "invalid_token";
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
    if (body?.error?.status === "INVALID_ARGUMENT" && /token/i.test(body.error.message ?? "")) return "invalid_token";
  }
  return "failed";
}

let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(account: ServiceAccount, now: Date): Promise<string> {
  if (cached && cached.expiresAt > now.getTime() + 60_000) return cached.token;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedAssertion(account, now) }),
  });
  if (!response.ok) throw new Error(`Google token endpoint answered ${response.status}`);
  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: access_token, expiresAt: now.getTime() + expires_in * 1000 };
  return access_token;
}

/** Sends one message to each token. Null when push is not configured (nothing was sent). */
export async function sendToTokens(tokens: string[], message: PushMessage, now = new Date()): Promise<Map<string, SendResult> | null> {
  const account = serviceAccount();
  if (!account) return null;
  const results = new Map<string, SendResult>();
  if (tokens.length === 0) return results;
  const bearer = await accessToken(account, now);
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
          body: JSON.stringify(fcmMessage(token, message)),
        });
        results.set(token, await classifyResponse(response));
      } catch {
        results.set(token, "failed");
      }
    }),
  );
  return results;
}
