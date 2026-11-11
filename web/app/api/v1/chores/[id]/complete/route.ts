import { db } from "@/db";
import { failure, isUuid, json, requireUser } from "@/lib/api";
import { apiError } from "@/lib/http";
import { completeChore } from "@/lib/progress/service";

/** Completes a chore: 201 with points (or pointsPending when a parent must approve), 409 if already done in this window. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/chores/[id]/complete">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "chore_not_found", "No active chore with that id");

  const result = await completeChore(db, auth.userId, id, new Date());
  if (!result.ok) return failure(result);
  const { completion, pointsEarned, pointsPending, balance, unlockedAchievements } = result;
  return json({ completion, pointsEarned, pointsPending, balance, unlockedAchievements }, 201);
}
