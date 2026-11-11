import { z } from "zod";
import { authenticate } from "./auth/bearer";
import { apiError } from "./http";

export const NO_STORE = { "cache-control": "no-store" };

/** JSON response for per-user data, never cached. */
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** The signed-in user's id, or a 401 response. */
export function requireUser(request: Request): { userId: string } | { response: Response } {
  const claims = authenticate(request);
  return claims ? { userId: claims.sub } : { response: apiError(401, "unauthorized", "Missing or invalid access token") };
}

/** Catalog ids are UUIDs; anything else is simply not found (instead of a database error). */
export const isUuid = (value: string) => z.uuid().safeParse(value).success;

/** Maps a service failure to the standard error body. */
export const failure = (f: { status: number; code: string; message: string }) => apiError(f.status, f.code, f.message);

/** Service result → response: `onOk` for success, the standard error body for a failure. */
export function respond<R extends { ok: true } | { ok: false; status: number; code: string; message: string }>(
  result: R,
  onOk: (value: Extract<R, { ok: true }>) => Response,
): Response {
  return result.ok ? onOk(result as Extract<R, { ok: true }>) : failure(result as { status: number; code: string; message: string });
}

export const noContent = () => new Response(null, { status: 204, headers: NO_STORE });
