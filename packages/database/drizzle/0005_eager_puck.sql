CREATE TABLE "game_settings" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"max_cards_per_user" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "game_settings_singleton" CHECK ("game_settings"."singleton"),
	CONSTRAINT "game_settings_max_cards_positive" CHECK ("game_settings"."max_cards_per_user" > 0)
);
