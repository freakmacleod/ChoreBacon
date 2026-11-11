import { db } from "@/db";
import { isUuid, noContent, requireUser, respond } from "@/lib/api";
import { fulfilRedemption } from "@/lib/family/service";
import { apiError } from "@/lib/http";

/** Parents: mark a redeemed reward as handed over. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/me/family/redemptions/[id]/fulfil">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "redemption_not_found", "No pending redemption with that id in your family");
  return respond(await fulfilRedemption(db, auth.userId, id), noContent);
}
