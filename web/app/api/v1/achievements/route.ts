import { db } from "@/db";
import { json, requireUser } from "@/lib/api";
import { listAchievements } from "@/lib/progress/service";

/** All achievements; `unlockedAt` is null while locked. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return json(await listAchievements(db, auth.userId));
}
