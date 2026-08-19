CREATE TYPE "public"."trace_type" AS ENUM('travel', 'activity', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('walking', 'cycling', 'car', 'train', 'bus', 'ferry', 'flight', 'unknown');--> statement-breakpoint
CREATE TABLE "traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"from_section_id" uuid,
	"to_section_id" uuid,
	"type" "trace_type" DEFAULT 'unknown' NOT NULL,
	"transport_mode" "transport_mode" DEFAULT 'unknown' NOT NULL,
	"geom" geometry(LineString,4326),
	"confidence" "confidence" DEFAULT 'inferred' NOT NULL,
	"source" "provenance" DEFAULT 'auto' NOT NULL,
	"locked_fields" text[] DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"distance_m" real,
	"duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_from_section_id_sections_id_fk" FOREIGN KEY ("from_section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_to_section_id_sections_id_fk" FOREIGN KEY ("to_section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "traces_journey_id_idx" ON "traces" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "traces_geom_idx" ON "traces" USING gist ("geom");