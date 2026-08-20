-- Backfill arrival_at for sections that predate the required-field
-- constraint: derive from member photos' capture times, fall back to the
-- journey's start date, and finally the section's own creation time
-- (always present) so no row can be left without a value.
UPDATE "sections" s
SET "arrival_at" = COALESCE(
  (SELECT MIN(p."captured_at") FROM "photos" p WHERE p."section_id" = s."id" AND p."captured_at" IS NOT NULL),
  (SELECT j."start_date"::timestamptz FROM "journeys" j WHERE j."id" = s."journey_id"),
  s."created_at"
)
WHERE s."arrival_at" IS NULL;
--> statement-breakpoint
-- Opportunistic geom backfill where derivable from member photos. Not
-- required for a constraint (geom stays nullable) — just shrinks the set of
-- legacy sections that would otherwise need a manual "set location" fix.
UPDATE "sections" s
SET "geom" = (
  SELECT ST_Centroid(ST_Collect(p."geom"))
  FROM "photos" p
  WHERE p."section_id" = s."id" AND p."geom" IS NOT NULL
)
WHERE s."geom" IS NULL
AND EXISTS (SELECT 1 FROM "photos" p WHERE p."section_id" = s."id" AND p."geom" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "sections" ALTER COLUMN "arrival_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN "order_index";
