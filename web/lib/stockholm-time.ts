export const BUSINESS_TIME_ZONE = "Europe/Stockholm";

export type Frequency = "daily" | "weekly" | "monthly" | "once";

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) of `instant` in Europe/Stockholm. Never derive "today" in UTC. */
export function stockholmDate(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return dateParts.format(instant);
}

/** The calendar date `days` after (or before, if negative) `localDate`. Pure calendar arithmetic. */
export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO 8601 week (Monday start) of a calendar date, e.g. "2026-W46". */
export function isoWeek(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  // Pure calendar arithmetic on a UTC-anchored date — no time zone involved past this point.
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() || 7; // Mon=1 … Sun=7
  // The Thursday of this week decides which ISO year the week belongs to.
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * The frequency window a completion at `instant` falls in, in Europe/Stockholm time.
 * A chore may be completed at most once per (user, chore, period key) — enforced by a unique index.
 */
export function periodKey(frequency: Frequency, instant: Date): string {
  const localDate = stockholmDate(instant);
  switch (frequency) {
    case "daily":
      return localDate;
    case "weekly":
      return isoWeek(localDate);
    case "monthly":
      return localDate.slice(0, 7);
    case "once":
      return "once";
  }
}
