ALTER TABLE "command_reward" ADD COLUMN "message_text_id" uuid;--> statement-breakpoint
UPDATE "command_reward" SET "message_text_id" = gen_random_uuid();--> statement-breakpoint
INSERT INTO "localized_texts" ("id") SELECT "message_text_id" FROM "command_reward";--> statement-breakpoint
INSERT INTO "localized_text_translations" ("localized_text_id", "locale", "content") SELECT "message_text_id", 'pt', "message" FROM "command_reward";--> statement-breakpoint
ALTER TABLE "command_reward" ALTER COLUMN "message_text_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "command_reward" ADD CONSTRAINT "command_reward_message_text_id_localized_texts_id_fk" FOREIGN KEY ("message_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_reward" DROP COLUMN "message";