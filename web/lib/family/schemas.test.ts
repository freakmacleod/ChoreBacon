import { describe, expect, it } from "vitest";
import { familyChoreBody, familyRewardBody } from "./schemas";

describe("family item bodies", () => {
  const chore = { title: "Rasta hunden", points: 15, frequency: "daily", isActive: true };

  it("defaults the icon and accepts icons from the shared set", () => {
    expect(familyChoreBody.parse(chore).icon).toBe("chore_default");
    expect(familyChoreBody.parse({ ...chore, icon: "dog_walk" }).icon).toBe("dog_walk");
    expect(familyRewardBody.parse({ title: "Glass", cost: 30, stock: null, isActive: true }).icon).toBe("reward_default");
  });

  it("refuses icons outside the shared set", () => {
    expect(familyChoreBody.safeParse({ ...chore, icon: "made_up_icon" }).success).toBe(false);
    expect(familyRewardBody.safeParse({ title: "Glass", cost: 30, stock: null, isActive: true, icon: "reward_made_up" }).success).toBe(false);
  });
});
