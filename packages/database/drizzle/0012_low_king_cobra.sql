ALTER TABLE "teams" ADD COLUMN "colors" jsonb DEFAULT '[]'::jsonb NOT NULL;
UPDATE "teams" SET "colors" = jsonb_build_array("color");