CREATE TABLE "admin_ai_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner" varchar(64) NOT NULL,
	"title" varchar(120) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"model" text,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_ai_history_owner_updated" ON "admin_ai_history" USING btree ("owner","updated_at","id");