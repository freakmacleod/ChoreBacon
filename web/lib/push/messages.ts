import type { PushMessage } from "./fcm";

// The Swedish texts of the push notifications. Pure, so they can be tested without sending anything.

const deadlineFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** A deadline in Swedish time, e.g. "fre 20 nov. 18:00". */
export const formatDeadline = (instant: Date) => deadlineFormat.format(instant);

/** "A", "A och B", "A, B och C", or the first three and "och 2 till". */
export function swedishList(items: string[], max = 3): string {
  if (items.length > max) return `${items.slice(0, max).join(", ")} och ${items.length - max} till`;
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} och ${items.at(-1)}`;
}

export function temporaryChoreMessage(chore: { id: string; title: string; points: number; expiresAt: Date }): PushMessage {
  return {
    title: "⏳ Ny tidsbegränsad syssla",
    body: `${chore.title} – ${chore.points} poäng. Först till kvarn, senast ${formatDeadline(chore.expiresAt)}.`,
    data: { kind: "temporary_chore", choreId: chore.id },
  };
}

export function comboMessage(combo: { id: string; title: string; bonusPoints: number; period: "day" | "week" }): PushMessage {
  return {
    title: "🎰 Ny kombo – bonus att hämta!",
    body: `${combo.title}: gör alla sysslorna ${combo.period === "day" ? "samma dag" : "samma vecka"} och få ${combo.bonusPoints} bonuspoäng.`,
    data: { kind: "combo", comboId: combo.id },
  };
}

export type ReminderContent = {
  /** Daily chores not done yet today. */
  undone: string[];
  /** Temporary chores not done yet whose deadline is close. */
  expiring: { title: string; expiresAt: Date }[];
  /** Combos started but not finished this period. */
  combos: { title: string; left: number; bonusPoints: number }[];
};

/** The reminder for one user, or null when there is nothing to remind about. */
export function reminderMessage(content: ReminderContent): PushMessage | null {
  const lines: string[] = [];
  if (content.undone.length > 0) lines.push(`Kvar idag: ${swedishList(content.undone)}.`);
  for (const chore of content.expiring) lines.push(`⏳ ${chore.title} – senast ${formatDeadline(chore.expiresAt)}.`);
  for (const combo of content.combos)
    lines.push(`🎰 ${combo.left === 1 ? "1 syssla" : `${combo.left} sysslor`} kvar till ${combo.title} (+${combo.bonusPoints}).`);
  if (lines.length === 0) return null;
  return { title: "Glöm inte dina sysslor! 🥓", body: lines.join("\n"), data: { kind: "reminder" } };
}
