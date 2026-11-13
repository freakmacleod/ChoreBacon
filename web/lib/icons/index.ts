import data from "./catalog-icons.json";

// The shared icon set (catalog-icons.json; the app embeds the same file). The admin shows a picker
// instead of asking for raw keys, and only accepts keys from the set.

export type IconKind = "chore" | "reward" | "achievement" | "combo";
export type CatalogIcon = { key: string; glyph: string; label: string };
export type IconGroup = { kind: IconKind; fallback: string; icons: CatalogIcon[] };

export const iconGroups = data.groups as IconGroup[];

const byKey = new Map(iconGroups.flatMap((group) => group.icons.map((icon) => [icon.key, icon] as const)));

export const DEFAULT_GLYPH = "⭐";

export function isKnownIcon(key: string): boolean {
  return byKey.has(key);
}

/** The groups with the item's own kind first, so its icons are at the top of the picker. */
export function iconGroupsFor(kind: IconKind): IconGroup[] {
  return [...iconGroups].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));
}

/** Same fallback as the app: an unknown key never shows raw, reward_/ach_/combo_ keys get their kind's default. */
export function iconGlyph(key: string | null | undefined): string {
  const known = key ? byKey.get(key) : undefined;
  if (known) return known.glyph;
  if (key?.startsWith("reward_")) return byKey.get("reward_default")!.glyph;
  if (key?.startsWith("ach_")) return byKey.get("achievement_default")!.glyph;
  if (key?.startsWith("combo_")) return byKey.get("combo_default")!.glyph;
  return DEFAULT_GLYPH;
}
