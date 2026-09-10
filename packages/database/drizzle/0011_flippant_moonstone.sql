ALTER TABLE "cards" ADD COLUMN "nationality" varchar(100);--> statement-breakpoint
UPDATE "cards" AS card
SET "nationality" = nationality."name"
FROM "nationalities" AS nationality
WHERE card."nationality_id" = nationality."id";--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "nationality" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" RENAME COLUMN "external_key" TO "slug";--> statement-breakpoint
DROP INDEX "cards_external_key_unique";--> statement-breakpoint
UPDATE "cards"
SET "slug" = COALESCE(
  NULLIF(trim(BOTH '-' FROM regexp_replace(lower("slug"), '[^a-z0-9]+', '-', 'g')), ''),
  'card'
);--> statement-breakpoint
WITH duplicate_slugs AS (
  SELECT "slug" FROM "cards" GROUP BY "slug" HAVING count(*) > 1
)
UPDATE "cards"
SET "slug" = left("slug", 63) || '-' || "id"::text
WHERE "slug" IN (SELECT "slug" FROM duplicate_slugs);--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
UPDATE "collections" AS collection
SET "slug" = COALESCE(
  NULLIF(trim(BOTH '-' FROM regexp_replace(lower(translation."content"), '[^a-z0-9]+', '-', 'g')), ''),
  'collection'
)
FROM "localized_text_translations" AS translation
WHERE translation."localized_text_id" = collection."name_text_id"
  AND translation."locale" = 'pt-BR';--> statement-breakpoint
UPDATE "collections"
SET "slug" = 'collection-' || "id"::text
WHERE "slug" IS NULL;--> statement-breakpoint
WITH duplicate_slugs AS (
  SELECT "slug" FROM "collections" GROUP BY "slug" HAVING count(*) > 1
)
UPDATE "collections"
SET "slug" = left("slug", 63) || '-' || "id"::text
WHERE "slug" IN (SELECT "slug" FROM duplicate_slugs);--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
UPDATE "teams"
SET "slug" = COALESCE(
  NULLIF(trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''),
  'team'
);--> statement-breakpoint
WITH duplicate_slugs AS (
  SELECT "slug" FROM "teams" GROUP BY "slug" HAVING count(*) > 1
)
UPDATE "teams"
SET "slug" = left("slug", 63) || '-' || "id"::text
WHERE "slug" IN (SELECT "slug" FROM duplicate_slugs);--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_nationality_id_nationalities_id_fk";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "nationality_id";--> statement-breakpoint
DROP TABLE "nationalities";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "cards_background_id_card_backgrounds_id_fk";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "background_id";--> statement-breakpoint
CREATE UNIQUE INDEX "cards_slug_unique" ON "cards" USING btree ("slug");