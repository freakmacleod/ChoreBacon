import { db } from "@/db";
import { noContent, requireUser, respond } from "@/lib/api";
import { leaveFamily } from "@/lib/family/service";

/** Leaves the family; 409 last_parent if others would be left without a parent. Points stay the user's. */
export async function POST(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await leaveFamily(db, auth.userId), noContent);
}
