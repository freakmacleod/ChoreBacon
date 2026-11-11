import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { joinFamilyBody } from "@/lib/family/schemas";
import { getFamily, joinFamily } from "@/lib/family/service";
import { parseJson } from "@/lib/http";

/** Joins the family with this invite code as a child; 404 invalid_invite_code, 409 already_in_family. */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, joinFamilyBody);
  if (!body.ok) return body.response;
  const joined = await joinFamily(db, auth.userId, body.data.code);
  if (!joined.ok) return respond(joined, () => json(null));
  return respond(await getFamily(db, auth.userId), ({ family }) => json(family));
}
