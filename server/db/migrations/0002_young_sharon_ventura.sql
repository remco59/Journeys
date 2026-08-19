CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."provenance" AS ENUM('auto', 'user_override');--> statement-breakpoint
CREATE TYPE "public"."photo_location_source" AS ENUM('exif', 'inferred', 'manual', 'unresolved');--> statement-breakpoint
CREATE TYPE "public"."import_file_status" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_source_type" AS ENUM('photo_batch', 'google_timeline', 'gpx', 'tcx', 'fit');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."observation_source" AS ENUM('photo', 'timeline_point', 'timeline_visit', 'timeline_movement', 'gpx', 'tcx', 'fit', 'manual');--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"import_file_id" uuid,
	"storage_key_original" varchar(500) NOT NULL,
	"storage_key_preview" varchar(500),
	"storage_key_thumb" varchar(500),
	"captured_at" timestamp with time zone,
	"tz_offset_minutes" integer,
	"geom" geometry(Point,4326),
	"altitude_m" real,
	"orientation" integer,
	"camera_make" varchar(100),
	"camera_model" varchar(100),
	"exif" jsonb,
	"location_source" "photo_location_source" DEFAULT 'unresolved' NOT NULL,
	"location_confidence" "confidence" DEFAULT 'inferred' NOT NULL,
	"section_id" uuid,
	"caption" text,
	"is_cover" boolean DEFAULT false NOT NULL,
	"source" "provenance" DEFAULT 'auto' NOT NULL,
	"locked_fields" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"status" "import_file_status" DEFAULT 'pending' NOT NULL,
	"error_message" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_files_journey_checksum_unique" UNIQUE("journey_id","checksum_sha256")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"source_type" "import_source_type" NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"parser_name" varchar(100),
	"parser_version" varchar(20),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"import_id" uuid,
	"source_type" "observation_source" NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"tz_offset_minutes" integer,
	"geom" geometry(Point,4326),
	"altitude_m" real,
	"accuracy_m" real,
	"confidence" "confidence" DEFAULT 'medium' NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_import_file_id_import_files_id_fk" FOREIGN KEY ("import_file_id") REFERENCES "public"."import_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_journey_captured_idx" ON "photos" USING btree ("journey_id","captured_at");--> statement-breakpoint
CREATE INDEX "photos_geom_idx" ON "photos" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "photos_section_id_idx" ON "photos" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "import_files_import_id_idx" ON "import_files" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "imports_journey_id_idx" ON "imports" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "observations_journey_captured_idx" ON "observations" USING btree ("journey_id","captured_at");--> statement-breakpoint
CREATE INDEX "observations_geom_idx" ON "observations" USING gist ("geom");--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;