CREATE TABLE "admin_ai_configs" (
	"owner" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(20) NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"models" jsonb NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
