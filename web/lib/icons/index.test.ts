import { describe, expect, it } from "vitest";
import { DEFAULT_GLYPH, iconGlyph, iconGroups, iconGroupsFor, isKnownIcon } from ".";

describe("catalog icon set", () => {
  it("has unique keys that fit the database key format", () => {
    const keys = iconGroups.flatMap((group) => group.icons.map((icon) => icon.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9_]{1,40}$/);
  });

  it("contains each group's fallback and every key used by the seeded catalog", () => {
    for (const group of iconGroups) expect(isKnownIcon(group.fallback)).toBe(true);
    const seeded = ["dishes", "vacuum", "trash", "laundry", "bathroom", "lawn", "pet", "bed", "reward_screen", "reward_dinner",
      "reward_icecream", "reward_movie", "reward_skip", "reward_game", "reward_late", "reward_pizza", "ach_first", "ach_10",
      "ach_50", "ach_100", "ach_pts100", "ach_pts500", "ach_streak3", "ach_streak7", "ach_streak30", "ach_spend"];
    for (const key of seeded) expect(isKnownIcon(key), key).toBe(true);
  });

  it("falls back like the app and never returns the raw key", () => {
    expect(iconGlyph("dishes")).toBe("🍽️");
    expect(iconGlyph("reward_unknown")).toBe("🎁");
    expect(iconGlyph("ach_unknown")).toBe("🏆");
    expect(iconGlyph("combo_unknown")).toBe("🎰");
    expect(iconGlyph("whatever")).toBe(DEFAULT_GLYPH);
    expect(iconGlyph(null)).toBe(DEFAULT_GLYPH);
  });

  it("puts the item's own kind first in the picker", () => {
    expect(iconGroupsFor("reward").map((g) => g.kind)).toEqual(["reward", "chore", "achievement", "combo"]);
    expect(iconGroupsFor("achievement")[0].kind).toBe("achievement");
  });
});
