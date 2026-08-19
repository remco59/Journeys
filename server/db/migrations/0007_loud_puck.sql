CREATE TABLE "journey_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"token" varchar(32) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "journey_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "journey_shares" ADD CONSTRAINT "journey_shares_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_shares" ADD CONSTRAINT "journey_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;