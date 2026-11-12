ALTER TABLE "achievements" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_family_idx" ON "achievements" USING btree ("family_id");