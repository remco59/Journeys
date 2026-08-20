CREATE TYPE "public"."distance_unit" AS ENUM('km', 'mi');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme" "theme" DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "distance_unit" "distance_unit" DEFAULT 'km' NOT NULL;