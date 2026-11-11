import { db } from "@/db";
import { isUuid, json, requireUser, respond } from "@/lib/api";
import { choreSettingsBody } from "@/lib/family/schemas";
import { setChoreSettings } from "@/lib/family/service";
import { apiError, parseJson } from "@/lib/http";

/** Parents: switch a global chore on/off for the family or override it (points). */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/me/family/chores/[id]/settings">) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "chore_not_found", "No active global chore with that id");
  const body = await parseJson(request, choreSettingsBody);
  if (!body.ok) return body.response;
  return respond(await setChoreSettings(db, auth.userId, id, body.data), () => json({ id }));
}
