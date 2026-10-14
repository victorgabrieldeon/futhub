ALTER TABLE "collections" ADD COLUMN "discord_emoji" varchar(64);--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "discord_emoji_file_id" uuid;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "discord_emoji" varchar(64);--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "discord_emoji_file_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "discord_emoji" varchar(64);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "discord_emoji_file_id" uuid;