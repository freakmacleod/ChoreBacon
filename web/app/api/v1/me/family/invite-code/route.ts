import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { regenerateInviteCode } from "@/lib/family/service";

/** Parents: replaces the invite code; the old one stops working. */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await regenerateInviteCode(db, auth.userId), ({ inviteCode }) => json({ inviteCode }));
}
