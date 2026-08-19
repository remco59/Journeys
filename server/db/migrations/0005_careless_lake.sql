CREATE TYPE "public"."activity_source_format" AS ENUM('gpx', 'tcx', 'fit');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('cycling', 'hiking', 'running', 'walking', 'swimming', 'other');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"section_id" uuid,
	"raw_import_file_id" uuid,
	"title" varchar(200) NOT NULL,
	"type" "activity_type" DEFAULT 'other' NOT NULL,
	"source_format" "activity_source_format" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"distance_m" real,
	"elevation_gain_m" real,
	"elevation_loss_m" real,
	"avg_speed_mps" real,
	"geom" geometry(LineString,4326),
	"stats" jsonb,
	"source" "provenance" DEFAULT 'auto' NOT NULL,
	"locked_fields" text[] DEFAULT '{}' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_raw_import_file_id_import_files_id_fk" FOREIGN KEY ("raw_import_file_id") REFERENCES "public"."import_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_journey_started_idx" ON "activities" USING btree ("journey_id","started_at");--> statement-breakpoint
CREATE INDEX "activities_geom_idx" ON "activities" USING gist ("geom");--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;