import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteAccount } from "@/lib/account/delete";
import { newConfirmationCode, recordDeletion } from "@/lib/account/receipts";
import { publicOrigin } from "@/lib/auth/config";
import { parseSignedRequest } from "@/lib/auth/facebook-signed-request";
import { apiError } from "@/lib/http";

/**
 * Facebook's data deletion callback: called when someone removes ChoreBacon in their Facebook settings.
 * Deletes (anonymises) their account and answers with a status URL and confirmation code, as Facebook
 * requires. Registered in the Facebook app as "Data deletion request URL".
 */
export async function POST(request: Request) {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) return apiError(503, "provider_not_configured", "Facebook is not configured in this environment");

  let signedRequest: unknown;
  try {
    signedRequest = (await request.formData()).get("signed_request");
  } catch {
    return apiError(400, "invalid_request", "Expected form data with signed_request");
  }
  const parsed = typeof signedRequest === "string" ? parseSignedRequest(signedRequest, secret) : null;
  if (!parsed) return apiError(400, "invalid_signed_request", "signed_request is missing or not signed by Facebook");

  const now = new Date();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.provider, "facebook"), eq(users.providerUserId, parsed.user_id), isNull(users.deletedAt)));
  // Facebook cannot be refused, so a family's last parent is deleted too (force).
  if (user) await deleteAccount(db, user.id, now, { force: true });

  // A receipt even when there was nothing to delete, so the status page answers for every code we hand out.
  const code = newConfirmationCode();
  await recordDeletion(db, code, now);
  return Response.json({ url: `${publicOrigin(request)}/radera-konto?kod=${code}`, confirmation_code: code });
}
