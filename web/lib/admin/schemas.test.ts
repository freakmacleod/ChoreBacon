import { describe, expect, it } from "vitest";
import { achievementInput, choreInput, parseForm, rewardInput } from "./schemas";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("admin form validation", () => {
  it("parses a chore and treats a missing checkbox as inactive", () => {
    const parsed = parseForm(choreInput, form({ title: " Diska ", description: "", icon: "dishes", points: "10", frequency: "daily" }));
    expect(parsed).toEqual({
      ok: true,
      data: { title: "Diska", description: "", icon: "dishes", points: 10, frequency: "daily", isActive: false },
    });
  });

  it("reports Swedish messages per field", () => {
    const parsed = parseForm(choreInput, form({ title: "", icon: "Bad Icon", points: "0", frequency: "yearly", isActive: "on" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toMatchObject({
      title: "Obligatoriskt",
      icon: expect.stringContaining("Små bokstäver"),
      points: "Minst 1",
      frequency: "Välj hur ofta",
    });
  });

  it("rejects fractional points", () => {
    const parsed = parseForm(choreInput, form({ title: "x", icon: "x", points: "2.5", frequency: "daily" }));
    expect(parsed.ok || parsed.errors.points).toBe("Ange ett heltal");
  });

  it("reads empty reward stock as unlimited and a number as explicit stock", () => {
    const base = { title: "Glass", icon: "reward_icecream", cost: "100" };
    const unlimited = parseForm(rewardInput, form({ ...base, stock: "" }));
    const limited = parseForm(rewardInput, form({ ...base, stock: "3", isActive: "on" }));
    expect(unlimited.ok && unlimited.data.stock).toBeNull();
    expect(limited.ok && [limited.data.stock, limited.data.isActive]).toEqual([3, true]);
    expect(parseForm(rewardInput, form({ ...base, stock: "-1" })).ok).toBe(false);
  });

  it("validates achievement rule, rarity and bonus", () => {
    const ok = parseForm(
      achievementInput,
      form({ code: "chores_25", title: "25", icon: "ach_25", ruleType: "chores_completed", threshold: "25", bonusPoints: "0", rarity: "rare" }),
    );
    expect(ok.ok).toBe(true);
    const bad = parseForm(
      achievementInput,
      form({ code: "x", title: "x", icon: "x", ruleType: "balance", threshold: "1", bonusPoints: "-5", rarity: "mythic" }),
    );
    expect(bad.ok ? {} : Object.keys(bad.errors).sort()).toEqual(["bonusPoints", "rarity", "ruleType"]);
  });
});
