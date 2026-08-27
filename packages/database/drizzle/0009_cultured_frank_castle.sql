ALTER TABLE "cards" ADD COLUMN "external_key" varchar(100);--> statement-breakpoint
UPDATE "cards" SET "external_key" = 'legacy-' || "id"::text WHERE "external_key" IS NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "external_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_external_key_unique" ON "cards" USING btree ("external_key");