import { describe, expect, it } from "vitest";
import { achievementInput, choreInput, comboInput, familyInput, familyMemberInput, parseForm, rewardInput, scopeInput } from "./schemas";

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

  it("parses a reward's stock: empty is unlimited (whether a global reward may have one is checked on save)", () => {
    const parsed = parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "100", stock: "3", isActive: "on" }));
    expect(parsed).toEqual({ ok: true, data: { title: "Glass", description: "", icon: "reward_icecream", cost: 100, stock: 3, isActive: true } });
    expect(parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "10", stock: "" }))).toMatchObject({ ok: true, data: { stock: null } });
    expect(parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "10" }))).toMatchObject({ ok: true, data: { stock: null } });
    expect(parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "10", stock: "-1" })).ok).toBe(false);
    expect(parseForm(rewardInput, form({ title: "Glass", icon: "reward_icecream", cost: "0" })).ok).toBe(false);
  });

  it("parses the scope picked when creating an item", () => {
    expect(parseForm(scopeInput, form({ scope: "global" }))).toEqual({ ok: true, data: { scope: null } });
    const familyId = "0b9c4f1e-3a2d-4c5b-9e8f-7a6b5c4d3e2f";
    expect(parseForm(scopeInput, form({ scope: familyId }))).toEqual({ ok: true, data: { scope: familyId } });
    expect(parseForm(scopeInput, form({ scope: "family-x" }))).toMatchObject({ ok: false, errors: { scope: "Välj global eller en familj" } });
    expect(parseForm(scopeInput, form({}))).toMatchObject({ ok: false });
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

  it("parses a combo's chores from a group of checkboxes", () => {
    const [a, b] = ["0b9c4f1e-3a2d-4c5b-9e8f-7a6b5c4d3e2f", "1c8d5e2f-4b3a-4d6c-8f9e-6b5a4c3d2e1f"];
    const data = form({ title: "Morgonrutin", icon: "combo_fire", bonusPoints: "20", period: "day", isActive: "on" });
    data.append("choreIds", a);
    data.append("choreIds", b);
    data.append("choreIds", a);
    expect(parseForm(comboInput, data)).toEqual({
      ok: true,
      data: { title: "Morgonrutin", description: "", icon: "combo_fire", bonusPoints: 20, period: "day", choreIds: [a, b], isActive: true },
    });

    const one = form({ title: "x", icon: "combo_fire", bonusPoints: "0", period: "month", choreIds: a });
    expect(parseForm(comboInput, one)).toMatchObject({
      ok: false,
      errors: { bonusPoints: "Minst 1", period: "Välj dag eller vecka", choreIds: "Välj minst två sysslor" },
    });
    expect(parseForm(comboInput, form({ title: "x", icon: "combo_fire", bonusPoints: "5", period: "week" }))).toMatchObject({
      ok: false,
      errors: { choreIds: "Välj minst två sysslor" },
    });
  });
});
