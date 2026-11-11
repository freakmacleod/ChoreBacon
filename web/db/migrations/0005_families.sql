DROP INDEX "family_members_user_idx";--> statement-breakpoint
ALTER TABLE "chore_completions" ADD COLUMN "points" integer;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "invite_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_family_settings" ADD COLUMN "stock" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "family_members_user_uq" ON "family_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_invite_code_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "reward_family_settings" ADD CONSTRAINT "reward_family_settings_stock_non_negative" CHECK ("reward_family_settings"."stock" IS NULL OR "reward_family_settings"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_global_unlimited" CHECK ("rewards"."family_id" IS NOT NULL OR "rewards"."stock" IS NULL);