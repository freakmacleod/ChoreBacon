import { db } from "@/db";
import { isUuid, json, requireUser, respond } from "@/lib/api";
import { familyChoreBody } from "@/lib/family/schemas";
import { updateFamilyChore } from "@/lib/family/service";
import { apiError, parseJson } from "@/lib/http";

/** Parents: edit (or deactivate, with isActive false) a family-only chore. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/me/family/chores/[id]">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "chore_not_found", "No family chore with that id");
  const body = await parseJson(request, familyChoreBody);
  if (!body.ok) return body.response;
  return respond(await updateFamilyChore(db, auth.userId, id, body.data), () => json({ id }));
}
