CREATE TYPE "public"."card_claim_origin" AS ENUM('pack', 'redeem', 'mission', 'hire');--> statement-breakpoint
CREATE TYPE "public"."card_position" AS ENUM('GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA');--> statement-breakpoint
CREATE TABLE "card_backgrounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(16) NOT NULL,
	"image_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_backgrounds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "card_market_config" (
	"singleton" boolean DEFAULT true NOT NULL,
	"sell_multiplier_basis_points" integer DEFAULT 2000 NOT NULL,
	"buy_multiplier_basis_points" integer DEFAULT 20000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_market_config_singleton_unique" UNIQUE("singleton"),
	CONSTRAINT "card_market_config_singleton" CHECK ("card_market_config"."singleton"),
	CONSTRAINT "card_market_config_multipliers_nonnegative" CHECK ("card_market_config"."sell_multiplier_basis_points" >= 0 and "card_market_config"."buy_multiplier_basis_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "card_price_configs" (
	"overall" integer PRIMARY KEY NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_price_configs_overall_range" CHECK ("card_price_configs"."overall" between 60 and 100),
	CONSTRAINT "card_price_configs_price_nonnegative" CHECK ("card_price_configs"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "card_secondary_positions" (
	"card_id" uuid NOT NULL,
	"position" "card_position" NOT NULL,
	CONSTRAINT "card_secondary_positions_card_id_position_pk" PRIMARY KEY("card_id","position")
);
--> statement-breakpoint
CREATE TABLE "card_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passing" integer NOT NULL,
	"control" integer NOT NULL,
	"marking" integer NOT NULL,
	"pace" integer NOT NULL,
	"dribbling" integer NOT NULL,
	"finishing" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_stats_positive" CHECK ("card_stats"."passing" > 0 and "card_stats"."control" > 0 and "card_stats"."marking" > 0 and "card_stats"."pace" > 0 and "card_stats"."dribbling" > 0 and "card_stats"."finishing" > 0)
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"collection_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"nationality_id" uuid NOT NULL,
	"stats_id" uuid NOT NULL,
	"background_id" uuid,
	"position" "card_position" NOT NULL,
	"contracts_blocked" boolean DEFAULT false NOT NULL,
	"defense" integer NOT NULL,
	"attack" integer NOT NULL,
	"creation" integer NOT NULL,
	"overall" integer NOT NULL,
	"image_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_stats_id_unique" UNIQUE("stats_id"),
	CONSTRAINT "cards_overall_range" CHECK ("cards"."overall" between 60 and 100),
	CONSTRAINT "cards_attributes_positive" CHECK ("cards"."defense" > 0 and "cards"."attack" > 0 and "cards"."creation" > 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_text_id" uuid NOT NULL,
	"emoji" varchar(30) NOT NULL,
	"primary_color" varchar(16) NOT NULL,
	"secondary_color" varchar(16) NOT NULL,
	"image_url" varchar(2048),
	"overlay_url" varchar(2048),
	"banner_url" varchar(2048),
	"contracts_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "localized_text_translations" (
	"localized_text_id" uuid NOT NULL,
	"locale" varchar(35) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "localized_text_translations_localized_text_id_locale_pk" PRIMARY KEY("localized_text_id","locale")
);
--> statement-breakpoint
CREATE TABLE "localized_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nationalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(30) NOT NULL,
	"color" varchar(16) NOT NULL,
	"image_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nationalities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(30) NOT NULL,
	"color" varchar(16) NOT NULL,
	"image_url" varchar(2048),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"yellow_cards" integer DEFAULT 0 NOT NULL,
	"red_cards" integer DEFAULT 0 NOT NULL,
	"holder" boolean DEFAULT false NOT NULL,
	"holder_position" "card_position",
	"claimed_by" "card_claim_origin" DEFAULT 'pack' NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"captain" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_cards_statistics_nonnegative" CHECK ("user_cards"."goals" >= 0 and "user_cards"."assists" >= 0 and "user_cards"."matches" >= 0 and "user_cards"."yellow_cards" >= 0 and "user_cards"."red_cards" >= 0),
	CONSTRAINT "user_cards_holder_position" CHECK (("user_cards"."holder" and "user_cards"."holder_position" is not null) or (not "user_cards"."holder" and "user_cards"."holder_position" is null))
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "language" varchar(35) DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "booster" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "card_secondary_positions" ADD CONSTRAINT "card_secondary_positions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_nationality_id_nationalities_id_fk" FOREIGN KEY ("nationality_id") REFERENCES "public"."nationalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_stats_id_card_stats_id_fk" FOREIGN KEY ("stats_id") REFERENCES "public"."card_stats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_background_id_card_backgrounds_id_fk" FOREIGN KEY ("background_id") REFERENCES "public"."card_backgrounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_name_text_id_localized_texts_id_fk" FOREIGN KEY ("name_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "localized_text_translations" ADD CONSTRAINT "localized_text_translations_localized_text_id_localized_texts_id_fk" FOREIGN KEY ("localized_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_xp_nonnegative" CHECK ("usuarios"."xp" >= 0);--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_level_positive" CHECK ("usuarios"."level" > 0);