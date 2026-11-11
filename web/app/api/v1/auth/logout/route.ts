import { z } from "zod";
import { revokeSession } from "@/lib/auth/session";
import { parseJson } from "@/lib/http";

const Body = z.object({ refresh_token: z.string().min(1) });

export async function POST(request: Request) {
  const body = await parseJson(request, Body);
  if (!body.ok) return body.response;

  await revokeSession(body.data.refresh_token);
  return new Response(null, { status: 204 });
}
