import { db } from "@/db";
import { json } from "@/lib/api";
import { apiError } from "@/lib/http";
import { isCronRequest } from "@/lib/push/cron-auth";
import { sendReminders } from "@/lib/push/service";

/**
 * Sends the current reminder slot (16:00 and 19:00 Stockholm) to everyone with chores left. Triggered
 * several times an afternoon by .github/workflows/reminders.yml; each user gets each slot only once.
 */
async function handle(request: Request) {
  if (!isCronRequest(request)) return apiError(401, "unauthorized", "Missing or invalid cron secret");
  return json(await sendReminders(db, new Date()));
}

export const GET = handle;
export const POST = handle;
