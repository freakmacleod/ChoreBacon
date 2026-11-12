import { createHmac, timingSafeEqual } from "node:crypto";

// Facebook's data deletion callback posts `signed_request` = base64url(signature) "." base64url(JSON),
// where signature = HMAC-SHA256(the JSON part as sent, app secret). The payload's user_id is the
// app-scoped id we store as provider_user_id.
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

export type FacebookSignedRequest = { user_id: string; algorithm: string; issued_at?: number };

export function parseSignedRequest(signedRequest: string, appSecret: string): FacebookSignedRequest | null {
  const [signature, payload, extra] = signedRequest.split(".");
  if (!signature || !payload || extra !== undefined) return null;

  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<FacebookSignedRequest>;
    if (data.algorithm?.toUpperCase() !== "HMAC-SHA256" || typeof data.user_id !== "string" || !data.user_id) return null;
    return data as FacebookSignedRequest;
  } catch {
    return null;
  }
}
