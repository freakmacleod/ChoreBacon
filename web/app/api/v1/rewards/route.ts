import { db } from "@/db";
import { json, requireUser } from "@/lib/api";
import { listRewards } from "@/lib/progress/service";

/** Active rewards. `stock` null = unlimited, 0 = sold out. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return json(await listRewards(db));
}
