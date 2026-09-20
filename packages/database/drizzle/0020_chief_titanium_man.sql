CREATE TYPE "public"."team_tactic" AS ENUM('defensive', 'balanced', 'offensive');--> statement-breakpoint
ALTER TABLE "user_formations" ADD COLUMN "tactic" "team_tactic" DEFAULT 'balanced' NOT NULL;