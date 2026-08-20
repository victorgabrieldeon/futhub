CREATE TYPE "public"."mission_cadence" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
ALTER TABLE "user_missions" DROP CONSTRAINT "user_missions_user_id_mission_id_pk";--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "cadence" "mission_cadence" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "tier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "reward_item_id" uuid;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "cadence" "mission_cadence" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "period_key" varchar(10) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "tier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_missions" ALTER COLUMN "cadence" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_missions" ALTER COLUMN "period_key" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_missions" ALTER COLUMN "tier" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_missions" ALTER COLUMN "expires_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_reward_item_id_items_id_fk" FOREIGN KEY ("reward_item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_missions_user_mission_cadence_period_key_unique" ON "user_missions" USING btree ("user_id","mission_id","cadence","period_key");--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_tier_positive" CHECK ("missions"."tier" > 0);--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_tier_positive" CHECK ("user_missions"."tier" > 0);