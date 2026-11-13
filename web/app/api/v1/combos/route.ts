import { db } from "@/db";
import { json, requireUser } from "@/lib/api";
import { listCombos } from "@/lib/progress/service";

/** Active combos with each chore marked done for the combo's current Stockholm day or week. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return json(await listCombos(db, auth.userId, new Date()));
}
