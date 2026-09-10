CREATE TABLE "pack_presentations" (
	"pack_id" uuid PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"color" varchar(7) NOT NULL,
	"accent_color" varchar(7) NOT NULL,
	"text_color" varchar(7) NOT NULL,
	"effect" varchar(24) NOT NULL,
	"texture" varchar(24) NOT NULL,
	"texture_opacity" integer NOT NULL,
	"tint_opacity" integer NOT NULL,
	"headline" varchar(18) NOT NULL,
	"headline_size" integer NOT NULL,
	"headline_x" integer NOT NULL,
	"headline_y" integer NOT NULL,
	"kicker" varchar(60) NOT NULL,
	"kicker_x" integer NOT NULL,
	"kicker_y" integer NOT NULL,
	CONSTRAINT "pack_presentations_schema_version_valid" CHECK ("pack_presentations"."schema_version" = 1),
	CONSTRAINT "pack_presentations_opacity_valid" CHECK ("pack_presentations"."texture_opacity" between 0 and 65 and "pack_presentations"."tint_opacity" between 0 and 42),
	CONSTRAINT "pack_presentations_headline_size_valid" CHECK ("pack_presentations"."headline_size" between 24 and 100),
	CONSTRAINT "pack_presentations_headline_x_valid" CHECK ("pack_presentations"."headline_x" between 80 and 520),
	CONSTRAINT "pack_presentations_headline_y_valid" CHECK ("pack_presentations"."headline_y" between 190 and 470),
	CONSTRAINT "pack_presentations_kicker_x_valid" CHECK ("pack_presentations"."kicker_x" between 80 and 520),
	CONSTRAINT "pack_presentations_kicker_y_valid" CHECK ("pack_presentations"."kicker_y" between 120 and 300)
);
--> statement-breakpoint
ALTER TABLE "pack_presentations" ADD CONSTRAINT "pack_presentations_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;