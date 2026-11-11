import { db } from "@/db";
import { isUuid, json, requireUser, respond } from "@/lib/api";
import { rewardSettingsBody } from "@/lib/family/schemas";
import { setRewardSettings } from "@/lib/family/service";
import { apiError, parseJson } from "@/lib/http";

/** Parents: switch a global reward on/off for the family or override it (cost, family stock). */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/me/family/rewards/[id]/settings">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "reward_not_found", "No active global reward with that id");
  const body = await parseJson(request, rewardSettingsBody);
  if (!body.ok) return body.response;
  return respond(await setRewardSettings(db, auth.userId, id, body.data), () => json({ id }));
}
