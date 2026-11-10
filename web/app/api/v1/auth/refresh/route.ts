import { z } from "zod";
import { tokenBody } from "@/lib/auth/responses";
import { rotateRefreshToken } from "@/lib/auth/session";
import { apiError, parseJson } from "@/lib/http";

const Body = z.object({ refresh_token: z.string().min(1) });

export async function POST(request: Request) {
  const body = await parseJson(request, Body);
  if (!body.ok) return body.response;

  const result = await rotateRefreshToken(body.data.refresh_token);
  if (!result.ok) return apiError(401, result.code, "Sign in again");
  return Response.json(tokenBody(result.tokens), { headers: { "cache-control": "no-store" } });
}
