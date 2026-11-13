CREATE TYPE "public"."combo_period" AS ENUM('day', 'week');--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE 'combo_bonus';--> statement-breakpoint
CREATE TABLE "combo_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"combo_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"bonus_points" integer NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_chores" (
	"combo_id" uuid NOT NULL,
	"chore_id" uuid NOT NULL,
	CONSTRAINT "combo_chores_combo_id_chore_id_pk" PRIMARY KEY("combo_id","chore_id")
);
--> statement-breakpoint
CREATE TABLE "combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'combo_default' NOT NULL,
	"bonus_points" integer NOT NULL,
	"period" "combo_period" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"family_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "combos_bonus_positive" CHECK ("combos"."bonus_points" > 0)
);
--> statement-breakpoint
ALTER TABLE "combo_awards" ADD CONSTRAINT "combo_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_awards" ADD CONSTRAINT "combo_awards_combo_id_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_chores" ADD CONSTRAINT "combo_chores_combo_id_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_chores" ADD CONSTRAINT "combo_chores_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combos" ADD CONSTRAINT "combos_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "combo_awards_once_per_period_uq" ON "combo_awards" USING btree ("user_id","combo_id","period_key");--> statement-breakpoint
CREATE INDEX "combo_chores_chore_idx" ON "combo_chores" USING btree ("chore_id");--> statement-breakpoint
CREATE INDEX "combos_family_idx" ON "combos" USING btree ("family_id");