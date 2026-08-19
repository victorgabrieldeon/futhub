CREATE TYPE "public"."match_event_type" AS ENUM('kickoff', 'goal', 'yellow_card', 'red_card', 'fulltime');--> statement-breakpoint
CREATE TYPE "public"."ranked_queue_status" AS ENUM('waiting', 'matched');--> statement-breakpoint
CREATE TABLE "ranked_queue" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"division_id" uuid NOT NULL,
	"status" "ranked_queue_status" NOT NULL,
	"room_id" uuid,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranked_queue_status_room" CHECK (("ranked_queue"."status" = 'waiting' and "ranked_queue"."room_id" is null) or ("ranked_queue"."status" = 'matched' and "ranked_queue"."room_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "room_match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"minute" integer NOT NULL,
	"type" "match_event_type" NOT NULL,
	"player_user_card_id" uuid,
	"assist_user_card_id" uuid,
	"description" text NOT NULL,
	"home_goals" integer NOT NULL,
	"away_goals" integer NOT NULL,
	CONSTRAINT "room_match_events_sequence_positive" CHECK ("room_match_events"."sequence" > 0),
	CONSTRAINT "room_match_events_minute_range" CHECK ("room_match_events"."minute" between 0 and 90),
	CONSTRAINT "room_match_events_scores_nonnegative" CHECK ("room_match_events"."home_goals" >= 0 and "room_match_events"."away_goals" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_league_standings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"division_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_league_standings_nonnegative" CHECK ("user_league_standings"."points" >= 0 and "user_league_standings"."wins" >= 0 and "user_league_standings"."draws" >= 0 and "user_league_standings"."losses" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "seed" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "home_goals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "away_goals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "completed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ranked_queue" ADD CONSTRAINT "ranked_queue_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranked_queue" ADD CONSTRAINT "ranked_queue_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranked_queue" ADD CONSTRAINT "ranked_queue_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_match_events" ADD CONSTRAINT "room_match_events_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_match_events" ADD CONSTRAINT "room_match_events_player_user_card_id_user_cards_id_fk" FOREIGN KEY ("player_user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_match_events" ADD CONSTRAINT "room_match_events_assist_user_card_id_user_cards_id_fk" FOREIGN KEY ("assist_user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_league_standings" ADD CONSTRAINT "user_league_standings_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_league_standings" ADD CONSTRAINT "user_league_standings_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ranked_queue_waiting_division_user_unique" ON "ranked_queue" USING btree ("division_id","user_id") WHERE "ranked_queue"."status" = 'waiting';--> statement-breakpoint
CREATE UNIQUE INDEX "room_match_events_room_sequence_unique" ON "room_match_events" USING btree ("room_id","sequence");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_seed_positive" CHECK ("rooms"."seed" > 0);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_scores_nonnegative" CHECK ("rooms"."home_goals" >= 0 and "rooms"."away_goals" >= 0);
--> statement-breakpoint
INSERT INTO "divisions" ("name", "emoji", "points", "color")
VALUES
	('Bronze', '🥉', 0, '#CD7F32'),
	('Prata', '🥈', 30, '#C0C0C0'),
	('Ouro', '🥇', 75, '#D4AF37'),
	('Platina', '🏅', 135, '#E5E4E2'),
	('Diamante', '💎', 210, '#B9F2FF')
ON CONFLICT ("name") DO NOTHING;