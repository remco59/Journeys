CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"place_name" varchar(300),
	"description" text,
	"geom" geometry(Point,4326),
	"arrival_at" timestamp with time zone,
	"departure_at" timestamp with time zone,
	"order_index" integer DEFAULT 0 NOT NULL,
	"confidence" "confidence" DEFAULT 'medium' NOT NULL,
	"source" "provenance" DEFAULT 'auto' NOT NULL,
	"locked_fields" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"cache_key" varchar(60) NOT NULL,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"place_name" varchar(300),
	"locality" varchar(200),
	"admin_area" varchar(200),
	"country" varchar(200),
	"place_type" varchar(60),
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "place_cache_provider_key_unique" UNIQUE("provider","cache_key")
);
--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sections_journey_arrival_idx" ON "sections" USING btree ("journey_id","arrival_at");--> statement-breakpoint
CREATE INDEX "sections_geom_idx" ON "sections" USING gist ("geom");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;