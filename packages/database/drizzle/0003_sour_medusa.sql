CREATE TABLE "formation_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formation_id" uuid NOT NULL,
	"position" "card_position" NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_text_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_config_excluded_cards" (
	"config_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	CONSTRAINT "pack_config_excluded_cards_config_id_card_id_pk" PRIMARY KEY("config_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "pack_config_excluded_collections" (
	"config_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "pack_config_excluded_collections_config_id_collection_id_pk" PRIMARY KEY("config_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "pack_config_excluded_positions" (
	"config_id" uuid NOT NULL,
	"position" "card_position" NOT NULL,
	CONSTRAINT "pack_config_excluded_positions_config_id_position_pk" PRIMARY KEY("config_id","position")
);
--> statement-breakpoint
CREATE TABLE "pack_config_excluded_teams" (
	"config_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "pack_config_excluded_teams_config_id_team_id_pk" PRIMARY KEY("config_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "pack_config_only_cards" (
	"config_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	CONSTRAINT "pack_config_only_cards_config_id_card_id_pk" PRIMARY KEY("config_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "pack_config_only_collections" (
	"config_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "pack_config_only_collections_config_id_collection_id_pk" PRIMARY KEY("config_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "pack_config_only_positions" (
	"config_id" uuid NOT NULL,
	"position" "card_position" NOT NULL,
	CONSTRAINT "pack_config_only_positions_config_id_position_pk" PRIMARY KEY("config_id","position")
);
--> statement-breakpoint
CREATE TABLE "pack_config_only_teams" (
	"config_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "pack_config_only_teams_config_id_team_id_pk" PRIMARY KEY("config_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "pack_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100),
	"min_overall" integer DEFAULT 60 NOT NULL,
	"max_overall" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "pack_configs_overall_range" CHECK ("pack_configs"."min_overall" between 60 and 100 and "pack_configs"."max_overall" between 60 and 100 and "pack_configs"."min_overall" <= "pack_configs"."max_overall")
);
--> statement-breakpoint
CREATE TABLE "pack_probabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) DEFAULT 'default' NOT NULL,
	"overall" integer NOT NULL,
	"probability" integer NOT NULL,
	CONSTRAINT "pack_probabilities_overall_range" CHECK ("pack_probabilities"."overall" between 60 and 100),
	CONSTRAINT "pack_probabilities_positive" CHECK ("pack_probabilities"."probability" > 0)
);
--> statement-breakpoint
CREATE TABLE "pack_probability_links" (
	"pack_id" uuid NOT NULL,
	"probability_id" uuid NOT NULL,
	CONSTRAINT "pack_probability_links_pack_id_probability_id_pk" PRIMARY KEY("pack_id","probability_id")
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"config_id" uuid NOT NULL,
	"image_url" varchar(2048),
	"color" varchar(16) NOT NULL,
	"emoji" varchar(255) NOT NULL,
	"cards_amount" integer DEFAULT 3 NOT NULL,
	"price" integer DEFAULT 15 NOT NULL,
	"can_buy" boolean DEFAULT true NOT NULL,
	"limit_per_user" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "packs_config_id_unique" UNIQUE("config_id"),
	CONSTRAINT "packs_values_valid" CHECK ("packs"."cards_amount" > 0 and "packs"."price" >= 0 and "packs"."limit_per_user" >= 0)
);
--> statement-breakpoint
CREATE TABLE "soccer_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_text_id" uuid NOT NULL,
	"color" varchar(16) NOT NULL,
	"image_url" varchar(2048)
);
--> statement-breakpoint
CREATE TABLE "user_formations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"formation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_packs" (
	"user_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_packs_user_id_pack_id_pk" PRIMARY KEY("user_id","pack_id"),
	CONSTRAINT "user_packs_quantity_nonnegative" CHECK ("user_packs"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_soccer_fields" (
	"user_id" uuid NOT NULL,
	"soccer_field_id" uuid NOT NULL,
	CONSTRAINT "user_soccer_fields_user_id_soccer_field_id_pk" PRIMARY KEY("user_id","soccer_field_id")
);
--> statement-breakpoint
ALTER TABLE "formation_slots" ADD CONSTRAINT "formation_slots_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formations" ADD CONSTRAINT "formations_name_text_id_localized_texts_id_fk" FOREIGN KEY ("name_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_cards" ADD CONSTRAINT "pack_config_excluded_cards_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_cards" ADD CONSTRAINT "pack_config_excluded_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_collections" ADD CONSTRAINT "pack_config_excluded_collections_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_collections" ADD CONSTRAINT "pack_config_excluded_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_positions" ADD CONSTRAINT "pack_config_excluded_positions_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_teams" ADD CONSTRAINT "pack_config_excluded_teams_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_excluded_teams" ADD CONSTRAINT "pack_config_excluded_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_cards" ADD CONSTRAINT "pack_config_only_cards_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_cards" ADD CONSTRAINT "pack_config_only_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_collections" ADD CONSTRAINT "pack_config_only_collections_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_collections" ADD CONSTRAINT "pack_config_only_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_positions" ADD CONSTRAINT "pack_config_only_positions_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_teams" ADD CONSTRAINT "pack_config_only_teams_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_config_only_teams" ADD CONSTRAINT "pack_config_only_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_probability_links" ADD CONSTRAINT "pack_probability_links_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_probability_links" ADD CONSTRAINT "pack_probability_links_probability_id_pack_probabilities_id_fk" FOREIGN KEY ("probability_id") REFERENCES "public"."pack_probabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_config_id_pack_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."pack_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soccer_fields" ADD CONSTRAINT "soccer_fields_name_text_id_localized_texts_id_fk" FOREIGN KEY ("name_text_id") REFERENCES "public"."localized_texts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_formations" ADD CONSTRAINT "user_formations_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_formations" ADD CONSTRAINT "user_formations_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_soccer_fields" ADD CONSTRAINT "user_soccer_fields_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_soccer_fields" ADD CONSTRAINT "user_soccer_fields_soccer_field_id_soccer_fields_id_fk" FOREIGN KEY ("soccer_field_id") REFERENCES "public"."soccer_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "formation_slots_coordinates_unique" ON "formation_slots" USING btree ("formation_id","x","y");