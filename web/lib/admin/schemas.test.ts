import { describe, expect, it } from "vitest";
import { achievementInput, choreInput, familyInput, familyMemberInput, parseForm, rewardInput } from "./schemas";

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
      icon: "Välj en ikon",
      points: "Minst 1",
      frequency: "Välj hur ofta",
    });
  });

  it("rejects fractional points", () => {
    const parsed = parseForm(choreInput, form({ title: "x", icon: "x", points: "2.5", frequency: "daily" }));
    expect(parsed.ok || parsed.errors.points).toBe("Ange ett heltal");
  });

  it("parses a global reward without stock (global rewards are unlimited)", () => {
    const parsed = parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "100", stock: "3", isActive: "on" }));
    expect(parsed).toEqual({ ok: true, data: { title: "Glass", description: "", icon: "reward_icecream", cost: 100, isActive: true } });
    expect(parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "0" })).ok).toBe(false);
  });

  it("validates achievement rule, rarity and bonus", () => {
    const ok = parseForm(
      achievementInput,
      form({ code: "chores_25", title: "25", icon: "ach_star", ruleType: "chores_completed", threshold: "25", bonusPoints: "0", rarity: "rare" }),
    );
    expect(ok.ok).toBe(true);
    const bad = parseForm(
      achievementInput,
      form({ code: "x", title: "x", icon: "x", ruleType: "balance", threshold: "1", bonusPoints: "-5", rarity: "mythic" }),
    );
    expect(bad.ok ? {} : Object.keys(bad.errors).sort()).toEqual(["bonusPoints", "icon", "rarity", "ruleType"]);
  });

  it("only accepts icons from the shared icon set", () => {
    const withIcon = (icon: string) => parseForm(rewardInput, form({ title: "Glass", icon, cost: "10" }));
    expect(withIcon("reward_icecream").ok).toBe(true);
    // Any kind's icon is fine; a well-formed but unknown key is not.
    expect(withIcon("dishes").ok).toBe(true);
    expect(withIcon("reward_unicorn_rides")).toMatchObject({ ok: false, errors: { icon: "Välj en ikon" } });
  });

  it("validates the family forms", () => {
    expect(parseForm(familyInput, form({ name: " Familjen ", requiresApproval: "on" }))).toEqual({
      ok: true,
      data: { name: "Familjen", requiresApproval: true },
    });
    expect(parseForm(familyInput, form({ name: "" }))).toMatchObject({ ok: false, errors: { name: "Obligatoriskt" } });
    const member = parseForm(familyMemberInput, form({ userId: "nope", role: "admin" }));
    expect(member.ok ? {} : Object.keys(member.errors).sort()).toEqual(["role", "userId"]);
  });
});
