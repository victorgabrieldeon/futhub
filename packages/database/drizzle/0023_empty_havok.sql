CREATE TABLE "user_clubs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stadium_level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_clubs_stadium_level_range" CHECK ("user_clubs"."stadium_level" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "user_clubs" ADD CONSTRAINT "user_clubs_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "command_config" SET "cooldown_seconds" = 86400 WHERE "command_name" = 'lucro' AND "cooldown_seconds" = 600;