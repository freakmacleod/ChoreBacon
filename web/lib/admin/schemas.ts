import { z } from "zod";
import { isKnownIcon } from "../icons";
import { fromStockholmDateTime } from "../stockholm-time";

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
export const COMBO_PERIODS = ["day", "week"] as const;

export const choreInput = z
  .object({
    title: required(100),
    description: text(500).default(""),
    icon,
    points: int(1, 10_000),
    frequency: z.enum(FREQUENCIES, { error: "Välj hur ofta" }),
    // Empty = a regular chore. Otherwise a Stockholm date and time ("YYYY-MM-DDTHH:mm" from a
    // datetime-local input): the chore is temporary and disappears then if nobody has done it.
    expiresAt: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z
        .string()
        .transform((value, ctx) => fromStockholmDateTime(value) ?? (ctx.addIssue({ code: "custom", message: "Ange datum och tid" }), z.NEVER))
        .nullable(),
    ),
    isActive: checkbox,
  })
  .refine((chore) => chore.expiresAt === null || chore.frequency === "once", {
    path: ["frequency"],
    error: "En tidsbegränsad syssla görs en gång",
  });

export const rewardInput = z.object({
  title: required(100),
  description: text(500).default(""),
  icon,
  cost: int(1, 1_000_000),
  // Only family rewards have a stock (global rewards are unlimited; families set their own stock for
  // them in the app). Empty = unlimited.
  stock: z.preprocess((value) => (value === "" || value === undefined ? null : value), int(0, 1_000_000).nullable()),
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

export const comboInput = z.object({
  title: required(100),
  description: text(500).default(""),
  icon,
  bonusPoints: int(1, 100_000),
  period: z.enum(COMBO_PERIODS, { error: "Välj dag eller vecka" }),
  // One checkbox per chore: missing when none is ticked, a string for one, an array for several.
  choreIds: z.preprocess(
    (value) => (value === undefined ? [] : [value].flat()),
    z
      .array(z.uuid({ error: "Välj sysslor i listan" }))
      .min(2, { error: "Välj minst två sysslor" })
      .max(10, { error: "Högst 10 sysslor" })
      .transform((ids) => [...new Set(ids)]),
  ),
  isActive: checkbox,
});

/** Chosen once when an item is created: "global" or a family id. */
export const scopeInput = z.object({
  scope: z.union([z.literal("global").transform(() => null), z.uuid({ error: "Välj global eller en familj" })], {
    error: "Välj global eller en familj",
  }),
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
export type ComboInput = z.infer<typeof comboInput>;
export type FamilyInput = z.infer<typeof familyInput>;

export type FieldErrors = Partial<Record<string, string>>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Form data as an object; a name that occurs several times (a group of checkboxes) becomes an array. */
function formObject(form: FormData): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const [name, value] of form) object[name] = name in object ? [object[name], value].flat() : value;
  return object;
}

/** Validates form data; on failure returns the first message per field. */
export function parseForm<T>(schema: z.ZodType<T>, form: FormData): Parsed<T> {
  const result = schema.safeParse(formObject(form));
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}
