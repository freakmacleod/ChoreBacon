import { describe, expect, it } from "vitest";
import { addDays } from "../stockholm-time";
import { type AchievementDefinition, type ProgressStats, alreadyCompletedCode, planUnlocks, streakDays } from "./rules";

const stats = (s: Partial<ProgressStats>): ProgressStats => ({
  balance: 0,
  lifetimeEarned: 0,
  pointsSpent: 0,
  choresCompleted: 0,
  streakDays: 0,
  ...s,
});

const achievement = (id: string, ruleType: AchievementDefinition["ruleType"], threshold: number, bonusPoints = 0) => ({
  id,
  ruleType,
  threshold,
  bonusPoints,
});

describe("planUnlocks", () => {
  it("unlocks points achievements on lifetime earned even after everything was spent (business rule 1)", () => {
    const pts100 = achievement("pts100", "lifetime_points_earned", 100);
    const unlocked = planUnlocks([pts100], stats({ balance: 0, lifetimeEarned: 120, pointsSpent: 120 }), new Set());
    expect(unlocked).toEqual([pts100]);
  });

  it("does not unlock points achievements from a high balance alone", () => {
    const pts100 = achievement("pts100", "lifetime_points_earned", 100);
    expect(planUnlocks([pts100], stats({ balance: 150, lifetimeEarned: 90 }), new Set())).toEqual([]);
  });

  it("measures each rule against its own stat", () => {
    const all = [
      achievement("c", "chores_completed", 3),
      achievement("s", "streak_days", 3),
      achievement("p", "points_spent", 50),
    ];
    const unlocked = planUnlocks(all, stats({ choresCompleted: 3, streakDays: 2, pointsSpent: 50 }), new Set());
    expect(unlocked.map((a) => a.id)).toEqual(["c", "p"]);
  });

  it("skips achievements that are already unlocked", () => {
    const first = achievement("first", "chores_completed", 1, 5);
    expect(planUnlocks([first], stats({ choresCompleted: 4 }), new Set(["first"]))).toEqual([]);
  });

  it("lets a bonus cascade into a lifetime-points unlock in the same pass", () => {
    const first = achievement("first", "chores_completed", 1, 5);
    const pts100 = achievement("pts100", "lifetime_points_earned", 100, 10);
    const unlocked = planUnlocks([pts100, first], stats({ choresCompleted: 1, lifetimeEarned: 95 }), new Set());
    expect(unlocked.map((a) => a.id)).toEqual(["first", "pts100"]);
  });
});

describe("streakDays (Stockholm calendar days)", () => {
  const today = "2026-11-11";
  const days = (...offsets: number[]) => offsets.map((o) => addDays(today, o));

  it("counts consecutive days ending today", () => {
    expect(streakDays(days(0, -1, -2), today)).toBe(3);
  });

  it("keeps yesterday's streak alive until today is over", () => {
    expect(streakDays(days(-1, -2), today)).toBe(2);
  });

  it("is broken by a missed day", () => {
    expect(streakDays(days(-2, -3), today)).toBe(0);
    expect(streakDays(days(0, -2, -3), today)).toBe(1);
  });

  it("is zero without completions and ignores duplicates", () => {
    expect(streakDays([], today)).toBe(0);
    expect(streakDays(days(0, 0, -1), today)).toBe(2);
  });

  it("crosses month and year boundaries", () => {
    expect(streakDays(["2026-12-31", "2027-01-01"], "2027-01-01")).toBe(2);
    expect(streakDays(["2026-02-28", "2026-03-01"], "2026-03-01")).toBe(2);
  });
});

describe("alreadyCompletedCode (business rule 2)", () => {
  it("names the frequency window", () => {
    expect(alreadyCompletedCode("daily")).toBe("chore_already_completed_today");
    expect(alreadyCompletedCode("weekly")).toBe("chore_already_completed_this_week");
    expect(alreadyCompletedCode("monthly")).toBe("chore_already_completed_this_month");
    expect(alreadyCompletedCode("once")).toBe("chore_already_completed");
  });
});
