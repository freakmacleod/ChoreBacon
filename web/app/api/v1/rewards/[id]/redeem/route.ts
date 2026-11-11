import { db } from "@/db";
import { failure, isUuid, json, requireUser } from "@/lib/api";
import { apiError } from "@/lib/http";
import { redeemReward } from "@/lib/progress/service";

/** Redeems a reward atomically: 201, or 409 insufficient_points / reward_out_of_stock. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/rewards/[id]/redeem">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "reward_not_found", "No active reward with that id");

  const result = await redeemReward(db, auth.userId, id, new Date());
  if (!result.ok) return failure(result);
  const { redemption, balance, unlockedAchievements } = result;
  return json({ redemption, balance, unlockedAchievements }, 201);
}
