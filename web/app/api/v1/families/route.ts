import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { createFamilyBody } from "@/lib/family/schemas";
import { createFamily, getFamily } from "@/lib/family/service";
import { parseJson } from "@/lib/http";

/** Creates a family with the caller as its first parent; 201 with the family (including the invite code). */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, createFamilyBody);
  if (!body.ok) return body.response;
  const created = await createFamily(db, auth.userId, body.data.name);
  if (!created.ok) return respond(created, () => json(null));
  return respond(await getFamily(db, auth.userId), ({ family }) => json(family, 201));
}
