ALTER TABLE "redeems" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "redeems" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "redeems" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "redeems" ADD CONSTRAINT "redeems_max_claims_positive" CHECK ("redeems"."max_claims" is null or "redeems"."max_claims" > 0);