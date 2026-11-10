import { z } from "zod";

/**
 * Error body for every API failure. `code` is stable and machine-readable; the app maps it to a
 * Swedish message from its own resources, `message` is a developer-facing fallback.
 */
export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parses and validates a JSON request body with Zod (required on every endpoint that takes one). */
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "Request body must be JSON") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: apiError(400, "validation_failed", z.prettifyError(result.error)) };
  }
  return { ok: true, data: result.data };
}
