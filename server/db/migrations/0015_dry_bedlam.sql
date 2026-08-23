ALTER TYPE "public"."import_source_type" ADD VALUE 'immich' BEFORE 'google_timeline';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "immich_base_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "immich_api_key_enc" text;