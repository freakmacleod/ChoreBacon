import { db } from "@/db";
import { isUuid, json, requireUser, respond } from "@/lib/api";
import { reviewCompletion } from "@/lib/family/service";
import { apiError } from "@/lib/http";

/** Parents: reject a pending completion in the family; 409 not_pending if already reviewed. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/me/family/completions/[id]/reject">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "completion_not_found", "No such completion in your family");
  return respond(await reviewCompletion(db, auth.userId, id, false, new Date()), ({ status, unlockedAchievements }) =>
    json({ status, unlockedAchievements }),
  );
}
