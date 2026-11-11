import { db } from "@/db";
import { isUuid, json, noContent, requireUser, respond } from "@/lib/api";
import { memberRoleBody } from "@/lib/family/schemas";
import { removeMember, setMemberRole } from "@/lib/family/service";
import { apiError, parseJson } from "@/lib/http";

type Ctx = RouteContext<"/api/v1/me/family/members/[userId]">;
const notFound = () => apiError(404, "member_not_found", "No such family member");

/** Parents: make a member parent or child (a family always keeps a parent). */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { userId } = await ctx.params;
  if (!isUuid(userId)) return notFound();
  const body = await parseJson(request, memberRoleBody);
  if (!body.ok) return body.response;
  return respond(await setMemberRole(db, auth.userId, userId, body.data.role), () => json({ ok: true }));
}

/** Parents: remove another member from the family. */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const { userId } = await ctx.params;
  if (!isUuid(userId)) return notFound();
  return respond(await removeMember(db, auth.userId, userId), noContent);
}
