CREATE TABLE "command_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_name" varchar(80) NOT NULL,
	"cooldown_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_config_command_name_unique" UNIQUE("command_name"),
	CONSTRAINT "command_config_cooldown_positive" CHECK ("command_config"."cooldown_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "command_reward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_config_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"weight" integer NOT NULL,
	"message" text NOT NULL,
	CONSTRAINT "command_reward_value_positive" CHECK ("command_reward"."value" > 0),
	CONSTRAINT "command_reward_weight_positive" CHECK ("command_reward"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_cooldown" (
	"user_id" uuid NOT NULL,
	"command_config_id" uuid NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cooldown_user_id_command_config_id_pk" PRIMARY KEY("user_id","command_config_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"nome" varchar(80) NOT NULL,
	"url_avatar" varchar(2048),
	"saldo" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "command_reward" ADD CONSTRAINT "command_reward_command_config_id_command_config_id_fk" FOREIGN KEY ("command_config_id") REFERENCES "public"."command_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cooldown" ADD CONSTRAINT "user_cooldown_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cooldown" ADD CONSTRAINT "user_cooldown_command_config_id_command_config_id_fk" FOREIGN KEY ("command_config_id") REFERENCES "public"."command_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_discord_user_id_unique" ON "usuarios" USING btree ("discord_user_id");