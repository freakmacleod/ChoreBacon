import { z } from "zod";
import { isKnownIcon } from "../icons";

// JSON bodies of the family endpoints (validated with Zod, like every request body).

const title = z.string().trim().min(1).max(100);
const description = z.string().trim().max(500).default("");
// Only icons from the shared set (the app picks from the same file), like the admin.
const icon = z.string().trim().refine(isKnownIcon, { error: "Unknown icon" });
const stock = z.number().int().min(0).max(1_000_000).nullable();

export const createFamilyBody = z.object({ name: z.string().trim().min(1).max(60) });
export const joinFamilyBody = z.object({ code: z.string().max(20) });
export const updateFamilyBody = z
  .object({ name: z.string().trim().min(1).max(60).optional(), requiresApproval: z.boolean().optional() })
  .refine((b) => b.name !== undefined || b.requiresApproval !== undefined, { error: "Nothing to update" });
export const memberRoleBody = z.object({ role: z.enum(["parent", "child"]) });

/** A family's tweak of a global chore: switch it off, or change its points (null = catalog value). */
export const choreSettingsBody = z.object({
  isActive: z.boolean(),
  pointsOverride: z.number().int().min(1).max(10_000).nullable(),
});
/** A family's tweak of a global reward, including its own stock (null = unlimited). */
export const rewardSettingsBody = z.object({
  isActive: z.boolean(),
  costOverride: z.number().int().min(1).max(1_000_000).nullable(),
  stock,
});

export const familyChoreBody = z.object({
  title,
  description,
  icon: icon.default("chore_default"),
  points: z.number().int().min(1).max(10_000),
  frequency: z.enum(["daily", "weekly", "monthly", "once"]),
  isActive: z.boolean().default(true),
});
export const familyRewardBody = z.object({
  title,
  description,
  icon: icon.default("reward_default"),
  cost: z.number().int().min(1).max(1_000_000),
  stock,
  isActive: z.boolean().default(true),
});

export type ChoreSettings = z.infer<typeof choreSettingsBody>;
export type RewardSettings = z.infer<typeof rewardSettingsBody>;
export type FamilyChore = z.infer<typeof familyChoreBody>;
export type FamilyReward = z.infer<typeof familyRewardBody>;
