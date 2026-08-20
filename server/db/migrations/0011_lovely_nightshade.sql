ALTER TABLE "traces" ALTER COLUMN "transport_mode" SET DEFAULT 'unsure';--> statement-breakpoint
UPDATE "traces" SET "transport_mode" = 'unsure' WHERE "transport_mode" = 'unknown';