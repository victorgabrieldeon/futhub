CREATE TYPE "public"."file_source" AS ENUM('upload', 'import', 'seed', 'generated');--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"original_name" varchar(255),
	"sha256" varchar(64),
	"width" integer,
	"height" integer,
	"source" "file_source" NOT NULL,
	"source_url" varchar(2048),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "files_size_bytes_positive" CHECK ("files"."size_bytes" > 0),
	CONSTRAINT "files_dimensions_positive" CHECK (("files"."width" is null and "files"."height" is null) or ("files"."width" > 0 and "files"."height" > 0))
);
--> statement-breakpoint
ALTER TABLE "card_backgrounds" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "overlay_file_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "banner_file_id" uuid;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "premiums" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "soccer_fields" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "logo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "card_backgrounds" ADD CONSTRAINT "card_backgrounds_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_overlay_file_id_files_id_fk" FOREIGN KEY ("overlay_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_banner_file_id_files_id_fk" FOREIGN KEY ("banner_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premiums" ADD CONSTRAINT "premiums_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soccer_fields" ADD CONSTRAINT "soccer_fields_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;