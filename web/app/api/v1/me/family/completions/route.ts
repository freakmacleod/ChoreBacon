import { db } from "@/db";
import { json, requireUser, respond } from "@/lib/api";
import { pendingCompletions } from "@/lib/family/service";

/** Parents: completions in the family waiting for approval. */
export async function GET(request: Request) {
  const auth = requireUser(request);
  if ("response" in auth) return auth.response;
  return respond(await pendingCompletions(db, auth.userId), ({ items }) => json(items));
}
