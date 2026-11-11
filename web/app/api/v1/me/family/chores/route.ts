import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { familyChoreBody } from "@/lib/family/schemas";
import { createFamilyChore, familyChores } from "@/lib/family/service";
import { parseJson } from "@/lib/http";

/** Parents: the family's view of the chore catalog (global chores with settings, plus family-only ones). */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await familyChores(db, auth.userId), ({ items }) => json(items));
}

/** Parents: add a family-only chore. */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  const body = await parseJson(request, familyChoreBody);
  if (!body.ok) return body.response;
  return respond(await createFamilyChore(db, auth.userId, body.data), ({ id }) => json({ id }, 201));
}
