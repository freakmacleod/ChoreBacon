import { z } from "zod";
import { isKnownIcon } from "../icons";

// Zod schemas for the admin forms (FormData → typed input). Messages are Swedish: they are shown
// next to the fields.

const text = (max: number) => z.string({ error: "Obligatoriskt" }).trim().max(max, { error: `Högst ${max} tecken` });
const required = (max: number) => text(max).min(1, { error: "Obligatoriskt" });
const int = (min: number, max: number) =>
  z.coerce
    .number({ error: "Ange ett heltal" })
    .int({ error: "Ange ett heltal" })
    .min(min, { error: `Minst ${min}` })
    .max(max, { error: `Högst ${max}` });
// An unchecked checkbox is simply missing from the form data.
const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());
const key = z
  .string({ error: "Obligatoriskt" })
  .trim()
  .regex(/^[a-z0-9_]{1,40}$/, { error: "Små bokstäver a–z, siffror och _ (högst 40)" });
// Only icons from the shared set: anything else would show as a fallback glyph in the app.
const icon = z.string({ error: "Välj en ikon" }).trim().refine(isKnownIcon, { error: "Välj en ikon" });

export const FREQUENCIES = ["daily", "weekly", "monthly", "once"] as const;
export const ACHIEVEMENT_RULES = ["chores_completed", "lifetime_points_earned", "streak_days", "points_spent"] as const;
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

export const choreInput = z.object({
  title: required(100),
  description: text(500).default(""),
  icon,
  points: int(1, 10_000),
  frequency: z.enum(FREQUENCIES, { error: "Välj hur ofta" }),
  isActive: checkbox,
});

export const rewardInput = z.object({
  title: required(100),
  description: text(500).default(""),
  icon,
  cost: int(1, 1_000_000),
  // No stock here: global rewards are unlimited; stock is counted per family (set by parents).
  isActive: checkbox,
});

export const achievementInput = z.object({
  code: key,
  title: required(100),
  description: text(500).default(""),
  icon,
  ruleType: z.enum(ACHIEVEMENT_RULES, { error: "Välj regel" }),
  threshold: int(1, 10_000_000),
  bonusPoints: int(0, 100_000),
  rarity: z.enum(RARITIES, { error: "Välj sällsynthet" }),
  isActive: checkbox,
});

export const roleInput = z.object({ role: z.enum(["user", "admin"]) });

export const familyInput = z.object({
  name: required(60),
  requiresApproval: checkbox,
});

export const familyMemberInput = z.object({
  userId: z.uuid({ error: "Välj en användare" }),
  role: z.enum(["parent", "child"], { error: "Välj roll" }),
});

export type ChoreInput = z.infer<typeof choreInput>;
export type RewardInput = z.infer<typeof rewardInput>;
export type AchievementInput = z.infer<typeof achievementInput>;
export type FamilyInput = z.infer<typeof familyInput>;

export type FieldErrors = Partial<Record<string, string>>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Validates form data; on failure returns the first message per field. */
export function parseForm<T>(schema: z.ZodType<T>, form: FormData): Parsed<T> {
  const result = schema.safeParse(Object.fromEntries(form));
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}
