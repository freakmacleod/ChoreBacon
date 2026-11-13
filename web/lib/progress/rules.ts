import { addDays, type Frequency, isoWeek } from "../stockholm-time";

export type AchievementRule = "chores_completed" | "lifetime_points_earned" | "streak_days" | "points_spent";

export type ProgressStats = {
  /** SUM(delta) — what the user can spend. */
  balance: number;
  /** SUM(delta) WHERE delta > 0 — never reduced by spending (business rule 1). */
  lifetimeEarned: number;
  /** Points spent on rewards (positive number). */
  pointsSpent: number;
  /** Approved completions. */
  choresCompleted: number;
  streakDays: number;
};

export type AchievementDefinition = { id: string; ruleType: AchievementRule; threshold: number; bonusPoints: number };

/** The stat an achievement rule is measured against. Points achievements use lifetime earned, not the balance. */
export function ruleValue(rule: AchievementRule, stats: ProgressStats): number {
  switch (rule) {
    case "chores_completed":
      return stats.choresCompleted;
    case "lifetime_points_earned":
      return stats.lifetimeEarned;
    case "streak_days":
      return stats.streakDays;
    case "points_spent":
      return stats.pointsSpent;
  }
}

/**
 * Achievements to unlock now, in unlock order. Bonus points count as earned points, so a bonus can
 * push the user over a lifetime-points threshold — those unlock in the same pass.
 */
export function planUnlocks<T extends AchievementDefinition>(
  achievements: readonly T[],
  stats: ProgressStats,
  alreadyUnlocked: ReadonlySet<string>,
): T[] {
  const unlocked: T[] = [];
  const done = new Set(alreadyUnlocked);
  const current = { ...stats };
  for (let changed = true; changed; ) {
    changed = false;
    for (const achievement of achievements) {
      if (done.has(achievement.id) || ruleValue(achievement.ruleType, current) < achievement.threshold) continue;
      done.add(achievement.id);
      unlocked.push(achievement);
      current.balance += achievement.bonusPoints;
      current.lifetimeEarned += achievement.bonusPoints;
      changed = true;
    }
  }
  return unlocked;
}

/**
 * Consecutive Stockholm days with at least one approved completion, ending today — or yesterday, so
 * the streak survives until the user has had all of today to keep it going.
 */
export function streakDays(completionDates: Iterable<string>, today: string): number {
  const dates = new Set(completionDates);
  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** 409 error code when a chore was already done in its frequency window (business rule 2). */
export function alreadyCompletedCode(frequency: Frequency): string {
  switch (frequency) {
    case "daily":
      return "chore_already_completed_today";
    case "weekly":
      return "chore_already_completed_this_week";
    case "monthly":
      return "chore_already_completed_this_month";
    case "once":
      return "chore_already_completed";
  }
}

export type ComboPeriod = "day" | "week";

/**
 * The Stockholm window a combo is measured in for a completion on `localDate`: its period key (where
 * the bonus is booked once) and the first and last calendar dates it covers (ISO week = Monday–Sunday).
 */
export function comboWindow(period: ComboPeriod, localDate: string): { key: string; from: string; to: string } {
  if (period === "day") return { key: localDate, from: localDate, to: localDate };
  const [y, m, d] = localDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7; // Mon=1 … Sun=7
  const from = addDays(localDate, 1 - weekday);
  return { key: isoWeek(localDate), from, to: addDays(from, 6) };
}

/** A combo is complete when every one of its chores was done in the window. */
export function comboComplete(choreIds: readonly string[], doneChoreIds: ReadonlySet<string>): boolean {
  return choreIds.length > 0 && choreIds.every((id) => doneChoreIds.has(id));
}
