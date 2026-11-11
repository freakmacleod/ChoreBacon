import { db } from "@/db";
import { json, requireUser } from "@/lib/api";
import { progressSummary } from "@/lib/progress/service";

/** Dashboard numbers for the signed-in user. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return json(await progressSummary(db, auth.userId, new Date()));
}
