import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All timestamps are timestamptz (UTC). Business dates (local_date, period_key) are derived in
// Europe/Stockholm by lib/stockholm-time.ts — never in UTC.
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ── Enums ────────────────────────────────────────────────────────────────────

export const authProvider = pgEnum("auth_provider", ["google", "facebook", "dev"]);
export const globalRole = pgEnum("global_role", ["user", "admin"]);
export const familyRole = pgEnum("family_role", ["parent", "child"]);
export const choreFrequency = pgEnum("chore_frequency", ["daily", "weekly", "monthly", "once"]);
export const completionStatus = pgEnum("completion_status", ["pending", "approved", "rejected"]);
export const ledgerReason = pgEnum("ledger_reason", [
  "chore_completed",
  "reward_redeemed",
  "achievement_bonus",
  "admin_adjustment",
]);
export const redemptionStatus = pgEnum("redemption_status", ["pending", "fulfilled", "cancelled"]);
export const achievementRule = pgEnum("achievement_rule", [
  "chores_completed",
  "lifetime_points_earned",
  "streak_days",
  "points_spent",
]);
export const achievementRarity = pgEnum("achievement_rarity", [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

// ── Users and families ───────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: authProvider("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    // Global role only; parent/child is per family in family_members.
    role: globalRole("role").notNull().default("user"),
    createdAt: createdAt(),
    // Set when the account is deleted. The row is then anonymised (no name, email or provider id) but
    // kept, so the append-only ledger and history stay consistent without pointing at a person.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_provider_identity_uq").on(t.provider, t.providerUserId)],
);

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // When true, children's completions wait for a parent's approval before points are booked.
  requiresApproval: boolean("requires_approval").notNull().default(false),
  // Shared by a parent so others can join (as children). Stored normalised: 8 chars, no dash.
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: createdAt(),
});

export const familyMembers = pgTable(
  "family_members",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: familyRole("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One family per user (for now): the unique index on user_id enforces it.
  (t) => [primaryKey({ columns: [t.familyId, t.userId] }), uniqueIndex("family_members_user_uq").on(t.userId)],
);

// ── Catalog ──────────────────────────────────────────────────────────────────
// Global rows (family_id IS NULL) are templates managed in the admin GUI. Family-only rows carry
// a family_id. Per-family tweaks to global rows live in the *_family_settings tables — catalog
// rows are never copied into families.

export const chores = pgTable(
  "chores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleKey: text("title_key"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("chore_default"),
    points: integer("points").notNull(),
    frequency: choreFrequency("frequency").notNull(),
    isGlobal: boolean("is_global").notNull(),
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("chores_points_positive", sql`${t.points} > 0`),
    check("chores_scope", sql`${t.isGlobal} = (${t.familyId} IS NULL)`),
    index("chores_family_idx").on(t.familyId),
  ],
);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("reward_default"),
    cost: integer("cost").notNull(),
    // NULL = unlimited. Decremented atomically on redemption; sold out stays sold out.
    stock: integer("stock"),
    isActive: boolean("is_active").notNull().default(true),
    // NULL = global catalog item; otherwise family-only (mirrors chores).
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("rewards_cost_positive", sql`${t.cost} > 0`),
    check("rewards_stock_non_negative", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
    // Stock is counted per family: global rewards are unlimited; families set stock via
    // reward_family_settings.stock or on their own family-only rewards.
    check("rewards_global_unlimited", sql`${t.familyId} IS NOT NULL OR ${t.stock} IS NULL`),
    index("rewards_family_idx").on(t.familyId),
  ],
);

export const choreFamilySettings = pgTable(
  "chore_family_settings",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    choreId: uuid("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "cascade" }),
    pointsOverride: integer("points_override"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.familyId, t.choreId] }),
    check("chore_family_settings_points_positive", sql`${t.pointsOverride} IS NULL OR ${t.pointsOverride} > 0`),
  ],
);

export const rewardFamilySettings = pgTable(
  "reward_family_settings",
  {
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "cascade" }),
    costOverride: integer("cost_override"),
    // This family's stock of a global reward; NULL = unlimited. Decremented atomically on redemption.
    stock: integer("stock"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.familyId, t.rewardId] }),
    check("reward_family_settings_cost_positive", sql`${t.costOverride} IS NULL OR ${t.costOverride} > 0`),
    check("reward_family_settings_stock_non_negative", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
  ],
);

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("achievement_default"),
    ruleType: achievementRule("rule_type").notNull(),
    threshold: integer("threshold").notNull(),
    bonusPoints: integer("bonus_points").notNull().default(0),
    rarity: achievementRarity("rarity").notNull().default("common"),
    // Inactive achievements are hidden and never unlock; already unlocked ones stay unlocked.
    isActive: boolean("is_active").notNull().default(true),
    // NULL = global; otherwise only that family's members see and unlock it (mirrors chores and rewards).
    familyId: uuid("family_id").references(() => families.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("achievements_threshold_positive", sql`${t.threshold} > 0`),
    check("achievements_bonus_non_negative", sql`${t.bonusPoints} >= 0`),
    index("achievements_family_idx").on(t.familyId),
  ],
);

// ── Progress ─────────────────────────────────────────────────────────────────

export const choreCompletions = pgTable(
  "chore_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    choreId: uuid("chore_id")
      .notNull()
      .references(() => chores.id),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    // Europe/Stockholm calendar date of completed_at.
    localDate: date("local_date", { mode: "string" }).notNull(),
    // Frequency window in Europe/Stockholm: 2026-11-10 (daily), 2026-W46 (weekly), 2026-11 (monthly), once.
    periodKey: text("period_key").notNull(),
    status: completionStatus("status").notNull().default("approved"),
    // Points at completion time (after family overrides); booked when approved. NULL on rows from
    // before families existed, which were all approved and booked immediately.
    points: integer("points"),
  },
  (t) => [
    // Enforces "once per frequency window" in the DB; a rejected completion frees the slot.
    uniqueIndex("chore_completions_once_per_period_uq")
      .on(t.userId, t.choreId, t.periodKey)
      .where(sql`${t.status} <> 'rejected'`),
    index("chore_completions_user_date_idx").on(t.userId, t.localDate),
  ],
);

// Append-only (enforced by trigger in migrations). Balance = SUM(delta); lifetime earned = SUM(delta) WHERE delta > 0.
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // RESTRICT, not CASCADE: the append-only trigger would block a cascaded delete anyway, and
    // account deletion (GDPR) must decide explicitly how ledger history is anonymised.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    reason: ledgerReason("reason").notNull(),
    refId: uuid("ref_id"),
    createdAt: createdAt(),
  },
  (t) => [check("point_ledger_delta_non_zero", sql`${t.delta} <> 0`), index("point_ledger_user_idx").on(t.userId)],
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id),
    // Cost at time of redemption; catalog prices can change later.
    cost: integer("cost").notNull(),
    status: redemptionStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("redemptions_user_idx").on(t.userId)],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

// ── Auth ─────────────────────────────────────────────────────────────────────

// Refresh tokens are stored hashed (SHA-256) and rotated on every use. All tokens descending from one
// sign-in share a chain_id; presenting an already-used token revokes the whole chain (reuse detection).
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    chainId: uuid("chain_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("refresh_tokens_chain_idx").on(t.chainId), index("refresh_tokens_user_idx").on(t.userId)],
);

// ── Account deletion ─────────────────────────────────────────────────────────

// Receipts for deletion requests (e.g. Facebook's data deletion callback), looked up by the code shown
// to the person. Holds no personal data: only the code and when it was requested and done.
export const accountDeletions = pgTable("account_deletions", {
  code: text("code").primaryKey(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
