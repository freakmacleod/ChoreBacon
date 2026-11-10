CREATE TYPE "public"."achievement_rarity" AS ENUM('common', 'uncommon', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."achievement_rule" AS ENUM('chores_completed', 'lifetime_points_earned', 'streak_days', 'points_spent');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('google', 'facebook', 'dev');--> statement-breakpoint
CREATE TYPE "public"."chore_frequency" AS ENUM('daily', 'weekly', 'monthly', 'once');--> statement-breakpoint
CREATE TYPE "public"."completion_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."family_role" AS ENUM('parent', 'child');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ledger_reason" AS ENUM('chore_completed', 'reward_redeemed', 'achievement_bonus', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('pending', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'achievement_default' NOT NULL,
	"rule_type" "achievement_rule" NOT NULL,
	"threshold" integer NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"rarity" "achievement_rarity" DEFAULT 'common' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_code_unique" UNIQUE("code"),
	CONSTRAINT "achievements_threshold_positive" CHECK ("achievements"."threshold" > 0),
	CONSTRAINT "achievements_bonus_non_negative" CHECK ("achievements"."bonus_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chore_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chore_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_date" date NOT NULL,
	"period_key" text NOT NULL,
	"status" "completion_status" DEFAULT 'approved' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chore_family_settings" (
	"family_id" uuid NOT NULL,
	"chore_id" uuid NOT NULL,
	"points_override" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "chore_family_settings_family_id_chore_id_pk" PRIMARY KEY("family_id","chore_id"),
	CONSTRAINT "chore_family_settings_points_positive" CHECK ("chore_family_settings"."points_override" IS NULL OR "chore_family_settings"."points_override" > 0)
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_key" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'chore_default' NOT NULL,
	"points" integer NOT NULL,
	"frequency" "chore_frequency" NOT NULL,
	"is_global" boolean NOT NULL,
	"family_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chores_points_positive" CHECK ("chores"."points" > 0),
	CONSTRAINT "chores_scope" CHECK ("chores"."is_global" = ("chores"."family_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "family_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_members_family_id_user_id_pk" PRIMARY KEY("family_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "point_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_ledger_delta_non_zero" CHECK ("point_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"cost" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_family_settings" (
	"family_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"cost_override" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reward_family_settings_family_id_reward_id_pk" PRIMARY KEY("family_id","reward_id"),
	CONSTRAINT "reward_family_settings_cost_positive" CHECK ("reward_family_settings"."cost_override" IS NULL OR "reward_family_settings"."cost_override" > 0)
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'reward_default' NOT NULL,
	"cost" integer NOT NULL,
	"stock" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"family_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_cost_positive" CHECK ("rewards"."cost" > 0),
	CONSTRAINT "rewards_stock_non_negative" CHECK ("rewards"."stock" IS NULL OR "rewards"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"role" "global_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_family_settings" ADD CONSTRAINT "chore_family_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_family_settings" ADD CONSTRAINT "chore_family_settings_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_family_settings" ADD CONSTRAINT "reward_family_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_family_settings" ADD CONSTRAINT "reward_family_settings_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chore_completions_once_per_period_uq" ON "chore_completions" USING btree ("user_id","chore_id","period_key") WHERE "chore_completions"."status" <> 'rejected';--> statement-breakpoint
CREATE INDEX "chore_completions_user_date_idx" ON "chore_completions" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "chores_family_idx" ON "chores" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "family_members_user_idx" ON "family_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "point_ledger_user_idx" ON "point_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redemptions_user_idx" ON "redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rewards_family_idx" ON "rewards" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_identity_uq" ON "users" USING btree ("provider","provider_user_id");