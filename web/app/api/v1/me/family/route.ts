import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { updateFamilyBody } from "@/lib/family/schemas";
import { getFamily, updateFamily } from "@/lib/family/service";
import { parseJson } from "@/lib/http";

/** The caller's family with members and balances (invite code for parents); 404 no_family. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await getFamily(db, auth.userId), ({ family }) => json(family));
}

/** Parents: rename the family or switch approval on/off. */
export async function PATCH(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, updateFamilyBody);
  if (!body.ok) return body.response;
  const updated = await updateFamily(db, auth.userId, body.data);
  if (!updated.ok) return respond(updated, () => json(null));
  return respond(await getFamily(db, auth.userId), ({ family }) => json(family));
}
