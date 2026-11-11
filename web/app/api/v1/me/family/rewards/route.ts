import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { familyRewardBody } from "@/lib/family/schemas";
import { createFamilyReward, familyRewards } from "@/lib/family/service";
import { parseJson } from "@/lib/http";

/** Parents: the family's view of the reward catalog (global rewards with settings, plus family-only ones). */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await familyRewards(db, auth.userId), ({ items }) => json(items));
}

/** Parents: add a family-only reward. */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, familyRewardBody);
  if (!body.ok) return body.response;
  return respond(await createFamilyReward(db, auth.userId, body.data), ({ id }) => json({ id }, 201));
}
