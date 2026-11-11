import { z } from "zod";
import { isDevLoginEnabled } from "@/lib/auth/config";
import { tokenBody } from "@/lib/auth/responses";
import { startSession, upsertUser } from "@/lib/auth/session";
import { apiError, parseJson } from "@/lib/http";

const Body = z.object({ name: z.string().trim().min(1).max(50).default("Testanvändare") });

// DEBUG-only test login. Answers 404 — as if it did not exist — unless ALLOW_DEV_LOGIN=true,
// and never on a production deployment.
export async function POST(request: Request) {
  if (!isDevLoginEnabled()) return apiError(404, "not_found", "Not found");

  const body = await parseJson(request, Body);
  if (!body.ok) return body.response;

  const user = await upsertUser({
    provider: "dev",
    providerUserId: body.data.name.toLowerCase(),
    displayName: body.data.name,
    email: null,
  });
  const tokens = await startSession(user);
  return Response.json(tokenBody(tokens), { headers: { "cache-control": "no-store" } });
}
