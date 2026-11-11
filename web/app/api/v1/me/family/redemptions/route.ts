import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { pendingRedemptions } from "@/lib/family/service";

/** Parents: redeemed rewards in the family that still have to be handed over. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await pendingRedemptions(db, auth.userId), ({ items }) => json(items));
}
