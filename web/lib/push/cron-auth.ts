import { timingSafeEqual } from "node:crypto";

/**
 * Scheduled jobs call /api/cron/* with `Authorization: Bearer <CRON_SECRET>` (a GitHub Actions schedule,
 * since Vercel Hobby runs crons at most daily). Without CRON_SECRET the endpoints stay closed.
 */
export function isCronRequest(request: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 32) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
