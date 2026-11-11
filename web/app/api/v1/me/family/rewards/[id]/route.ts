import { db } from "@/db";
import { isUuid, json, requireUser, respond } from "@/lib/api";
import { familyRewardBody } from "@/lib/family/schemas";
import { updateFamilyReward } from "@/lib/family/service";
import { apiError, parseJson } from "@/lib/http";

/** Parents: edit (or deactivate, with isActive false) a family-only reward. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/me/family/rewards/[id]">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "reward_not_found", "No family reward with that id");
  const body = await parseJson(request, familyRewardBody);
  if (!body.ok) return body.response;
  return respond(await updateFamilyReward(db, auth.userId, id, body.data), () => json({ id }));
}
