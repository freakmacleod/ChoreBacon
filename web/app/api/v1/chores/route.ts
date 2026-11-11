import { db } from "@/db";
import { json, requireUser } from "@/lib/api";
import { listChores } from "@/lib/progress/service";

/** Active chores, each marked done/not done for its current Stockholm frequency window. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return json(await listChores(db, auth.userId, new Date()));
}
