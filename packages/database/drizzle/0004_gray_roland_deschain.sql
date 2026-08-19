CREATE TYPE "public"."item_type" AS ENUM('card', 'pack', 'balance', 'field', 'premium');--> statement-breakpoint
CREATE TYPE "public"."mission_type" AS ENUM('open_pack', 'sell_player', 'claim_profit', 'play_match');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('purchase', 'sale', 'trade', 'reward', 'redeem');--> statement-breakpoint
CREATE TABLE "command_xp_configs" (
	"command" varchar(100) PRIMARY KEY NOT NULL,
	"xp" integer NOT NULL,
	CONSTRAINT "command_xp_configs_xp_nonnegative" CHECK ("command_xp_configs"."xp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name_text_id" uuid,
	"emoji" varchar(50) NOT NULL,
	"points" integer NOT NULL,
	"color" varchar(16),
	"image_url" varchar(2048),
	CONSTRAINT "divisions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "generic_cooldown_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(100) NOT NULL,
	"available_uses" integer DEFAULT 1 NOT NULL,
	"cooldown_seconds" integer NOT NULL,
	CONSTRAINT "generic_cooldown_configs_resource_unique" UNIQUE("resource"),
	CONSTRAINT "generic_cooldown_configs_values_valid" CHECK ("generic_cooldown_configs"."available_uses" > 0 and "generic_cooldown_configs"."cooldown_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "generic_cooldowns" (
	"user_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	CONSTRAINT "generic_cooldowns_user_id_config_id_pk" PRIMARY KEY("user_id","config_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name_text_id" uuid,
	"type" "item_type" NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"card_id" uuid,
	"pack_id" uuid,
	"soccer_field_id" uuid,
	"premium_id" uuid,
	CONSTRAINT "items_amount_positive" CHECK ("items"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "level_rewards" (
	"level" integer PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "level_rewards_level_positive" CHECK ("level_rewards"."level" > 0)
);
--> statement-breakpoint
CREATE TABLE "mission_rewards" (
	"mission_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	CONSTRAINT "mission_rewards_mission_id_item_id_tier_pk" PRIMARY KEY("mission_id","item_id","tier"),
	CONSTRAINT "mission_rewards_tier_positive" CHECK ("mission_rewards"."tier" > 0)
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_text_id" uuid NOT NULL,
	"type" "mission_type" NOT NULL,
	"goal" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "missions_goal_positive" CHECK ("missions"."goal" > 0)
);
--> statement-breakpoint
CREATE TABLE "premium_packs" (
	"premium_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	CONSTRAINT "premium_packs_premium_id_pack_id_pk" PRIMARY KEY("premium_id","pack_id")
);
--> statement-breakpoint
CREATE TABLE "premium_soccer_fields" (
	"premium_id" uuid NOT NULL,
	"soccer_field_id" uuid NOT NULL,
	CONSTRAINT "premium_soccer_fields_premium_id_soccer_field_id_pk" PRIMARY KEY("premium_id","soccer_field_id")
);
--> statement-breakpoint
CREATE TABLE "premiums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"image_url" varchar(2048),
	"duration_days" integer NOT NULL,
	CONSTRAINT "premiums_values_valid" CHECK ("premiums"."price" >= 0 and "premiums"."duration_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "profit_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"probability" integer NOT NULL,
	"amount" integer NOT NULL,
	"description_text_id" uuid,
	CONSTRAINT "profit_configs_probability_positive" CHECK ("profit_configs"."probability" > 0),
	CONSTRAINT "profit_configs_amount_positive" CHECK ("profit_configs"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "redeem_claims" (
	"redeem_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redeem_claims_redeem_id_user_id_pk" PRIMARY KEY("redeem_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "redeems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"item_id" uuid NOT NULL,
	"max_claims" integer,
	CONSTRAINT "redeems_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_user_id" uuid NOT NULL,
	"away_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_distinct_users" CHECK ("rooms"."home_user_id" <> "rooms"."away_user_id")
);
--> statement-breakpoint
CREATE TABLE "topgg_configs" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"reward" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "topgg_configs_singleton" CHECK ("topgg_configs"."singleton"),
	CONSTRAINT "topgg_configs_reward_nonnegative" CHECK ("topgg_configs"."reward" >= 0)
);
--> statement-breakpoint
CREATE TABLE "topgg_history" (
	"user_id" uuid NOT NULL,
	"voted_on" timestamp with time zone NOT NULL,
	CONSTRAINT "topgg_history_user_id_voted_on_pk" PRIMARY KEY("user_id","voted_on")
);
--> statement-breakpoint
CREATE TABLE "trade_cards" (
	"trade_id" uuid NOT NULL,
	"user_card_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	CONSTRAINT "trade_cards_trade_id_user_card_id_pk" PRIMARY KEY("trade_id","user_card_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "trades_distinct_users" CHECK ("trades"."sender_id" <> "trades"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_missions" (
	"user_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "user_missions_user_id_mission_id_pk" PRIMARY KEY("user_id","mission_id"),
	CONSTRAINT "user_missions_progress_nonnegative" CHECK ("user_missions"."progress" >= 0)
);
--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_display_name_text_id_localized_texts_id_fk" FOREIGN KEY ("display_name_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generic_cooldowns" ADD CONSTRAINT "generic_cooldowns_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generic_cooldowns" ADD CONSTRAINT "generic_cooldowns_config_id_generic_cooldown_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."generic_cooldown_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_display_name_text_id_localized_texts_id_fk" FOREIGN KEY ("display_name_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_soccer_field_id_soccer_fields_id_fk" FOREIGN KEY ("soccer_field_id") REFERENCES "public"."soccer_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_premium_id_premiums_id_fk" FOREIGN KEY ("premium_id") REFERENCES "public"."premiums"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_rewards" ADD CONSTRAINT "level_rewards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_rewards" ADD CONSTRAINT "mission_rewards_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_rewards" ADD CONSTRAINT "mission_rewards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_title_text_id_localized_texts_id_fk" FOREIGN KEY ("title_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_packs" ADD CONSTRAINT "premium_packs_premium_id_premiums_id_fk" FOREIGN KEY ("premium_id") REFERENCES "public"."premiums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_packs" ADD CONSTRAINT "premium_packs_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_soccer_fields" ADD CONSTRAINT "premium_soccer_fields_premium_id_premiums_id_fk" FOREIGN KEY ("premium_id") REFERENCES "public"."premiums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_soccer_fields" ADD CONSTRAINT "premium_soccer_fields_soccer_field_id_soccer_fields_id_fk" FOREIGN KEY ("soccer_field_id") REFERENCES "public"."soccer_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_configs" ADD CONSTRAINT "profit_configs_description_text_id_localized_texts_id_fk" FOREIGN KEY ("description_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_claims" ADD CONSTRAINT "redeem_claims_redeem_id_redeems_id_fk" FOREIGN KEY ("redeem_id") REFERENCES "public"."redeems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_claims" ADD CONSTRAINT "redeem_claims_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeems" ADD CONSTRAINT "redeems_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_home_user_id_usuarios_id_fk" FOREIGN KEY ("home_user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_away_user_id_usuarios_id_fk" FOREIGN KEY ("away_user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topgg_history" ADD CONSTRAINT "topgg_history_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_owner_id_usuarios_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_sender_id_usuarios_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_recipient_id_usuarios_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;