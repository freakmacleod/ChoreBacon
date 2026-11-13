import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { Executor } from "../../db/executor";
import { chores, combos, deviceTokens, familyMembers, notificationLog, users } from "../../db/schema";
import { listChores, listCombos } from "../progress/service";
import { stockholmDate, stockholmDateTime } from "../stockholm-time";
import { type PushMessage, type SendResult, sendToTokens } from "./fcm";
import { comboMessage, reminderMessage, temporaryChoreMessage } from "./messages";

// Who gets which push notification. Sending goes through `send` (FCM by default) so tests can watch it.

export type Sender = (tokens: string[], message: PushMessage, now: Date) => Promise<Map<string, SendResult> | null>;

// ── Devices ──────────────────────────────────────────────────────────────────

/** Registers (or refreshes) this device for the user. A token already registered to someone else moves: the device changed hands. */
export async function registerDevice(exec: Executor, userId: string, token: string, platform: string, now: Date) {
  await exec
    .insert(deviceTokens)
    .values({ token, userId, platform, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: deviceTokens.token, set: { userId, platform, updatedAt: now } });
}

/** Signing out on a device stops its notifications. Only the user's own token can be removed. */
export async function unregisterDevice(exec: Executor, userId: string, token: string) {
  await exec.delete(deviceTokens).where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)));
}

// ── Sending ──────────────────────────────────────────────────────────────────

/** Sends to every device of these users and forgets the tokens FCM reports dead. */
export async function notifyUsers(exec: Executor, userIds: string[], message: PushMessage, now: Date, send: Sender = sendToTokens) {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  const tokens = (await exec.select({ token: deviceTokens.token }).from(deviceTokens).where(inArray(deviceTokens.userId, userIds))).map(
    (t) => t.token,
  );
  const results = await send(tokens, message, now);
  if (!results) return { sent: 0, removed: 0 }; // push is not configured
  const dead = [...results].filter(([, result]) => result === "invalid_token").map(([token]) => token);
  if (dead.length > 0) await exec.delete(deviceTokens).where(inArray(deviceTokens.token, dead));
  return { sent: [...results.values()].filter((r) => r === "sent").length, removed: dead.length };
}

/** Who hears about a new item: the family's members, or for a global item everyone with a registered device. */
async function audience(exec: Executor, familyId: string | null): Promise<string[]> {
  const rows = familyId
    ? await exec.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, familyId))
    : await exec.selectDistinct({ userId: deviceTokens.userId }).from(deviceTokens);
  return rows.map((r) => r.userId);
}

/** A new active temporary chore: tell everyone who can take it. */
export async function announceTemporaryChore(exec: Executor, choreId: string, now: Date, send?: Sender) {
  const [chore] = await exec.select().from(chores).where(eq(chores.id, choreId));
  if (!chore?.isActive || !chore.expiresAt || chore.expiresAt <= now) return { sent: 0, removed: 0 };
  return notifyUsers(exec, await audience(exec, chore.familyId), temporaryChoreMessage({ ...chore, expiresAt: chore.expiresAt }), now, send);
}

/** A new active combo: a bonus is up for grabs. */
export async function announceCombo(exec: Executor, comboId: string, now: Date, send?: Sender) {
  const [combo] = await exec.select().from(combos).where(eq(combos.id, comboId));
  if (!combo?.isActive) return { sent: 0, removed: 0 };
  return notifyUsers(exec, await audience(exec, combo.familyId), comboMessage(combo), now, send);
}

// ── Reminders ────────────────────────────────────────────────────────────────

/** Reminders go out at these Stockholm hours if chores are still undone. */
export const REMINDER_HOURS = [16, 19] as const;
/** A late trigger (scheduled jobs can be delayed) still sends the slot's reminder within this many hours. */
const SLOT_HOURS = 3;
/** Temporary chores due within this long are mentioned in reminders. */
const EXPIRING_SOON_MS = 24 * 3_600_000;

/** The reminder slot `now` falls in (Stockholm time), or null between slots. */
export function reminderSlot(now: Date): { key: string; hour: number } | null {
  const hour = Number(stockholmDateTime(now).slice(11, 13));
  const slot = [...REMINDER_HOURS].reverse().find((h) => hour >= h && hour < h + SLOT_HOURS);
  return slot === undefined ? null : { key: `reminder:${stockholmDate(now)}:${slot}`, hour: slot };
}

/**
 * Sends the current slot's reminder to everyone who does chores (children, and users without a family)
 * and still has something left: undone daily chores, temporary chores due soon, or unfinished combos.
 * Each user gets each slot at most once (notification_log), however often this runs.
 */
export async function sendReminders(exec: Executor, now: Date, send?: Sender) {
  const slot = reminderSlot(now);
  if (!slot) return { slot: null, reminded: 0 };

  const recipients = await exec
    .selectDistinct({ userId: deviceTokens.userId })
    .from(deviceTokens)
    .innerJoin(users, eq(users.id, deviceTokens.userId))
    .leftJoin(familyMembers, eq(familyMembers.userId, deviceTokens.userId))
    .where(and(isNull(users.deletedAt), or(isNull(familyMembers.role), eq(familyMembers.role, "child"))));

  let reminded = 0;
  for (const { userId } of recipients) {
    const choreList = await listChores(exec, userId, now);
    const open = choreList.filter((c) => !c.completedThisPeriod);
    const message = reminderMessage({
      undone: open.filter((c) => c.frequency === "daily" && !c.expiresAt).map((c) => c.title),
      expiring: open.flatMap((c) =>
        c.expiresAt && c.expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_MS ? [{ title: c.title, expiresAt: c.expiresAt }] : [],
      ),
      combos: (await listCombos(exec, userId, now)).flatMap((combo) => {
        const left = combo.chores.filter((c) => !c.done).length;
        return !combo.awardedThisPeriod && left > 0 && left < combo.chores.length
          ? [{ title: combo.title, left, bonusPoints: combo.bonusPoints }]
          : [];
      }),
    });
    if (!message) continue;

    // Claim the slot first, so two overlapping runs cannot both send it.
    const [claimed] = await exec
      .insert(notificationLog)
      .values({ userId, key: slot.key, sentAt: now })
      .onConflictDoNothing()
      .returning({ key: notificationLog.key });
    if (!claimed) continue;
    await notifyUsers(exec, [userId], message, now, send);
    reminded++;
  }
  return { slot: slot.key, reminded };
}

