import { addDays, type Frequency } from "../stockholm-time";

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
