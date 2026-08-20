ALTER TYPE "public"."transport_mode" ADD VALUE IF NOT EXISTS 'unsure';--> statement-breakpoint
CREATE TABLE "route_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"cache_key" varchar(80) NOT NULL,
	"found" varchar(10) NOT NULL,
	"geom" jsonb,
	"distance_m" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "route_cache_provider_key_unique" UNIQUE("provider","cache_key")
);
