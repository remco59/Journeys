import { pgTable, pgEnum, uuid, varchar, boolean, real, integer, timestamp, jsonb, text, index, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { importFiles } from './imports'
import { sections } from './sections'
import { confidenceEnum, provenanceEnum } from './enums'
import { geometryPoint } from '../postgis'

export const photoLocationSourceEnum = pgEnum('photo_location_source', ['exif', 'inferred', 'manual', 'unresolved'])

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    importFileId: uuid('import_file_id').references(() => importFiles.id, { onDelete: 'set null' }),

    storageKeyOriginal: varchar('storage_key_original', { length: 500 }).notNull(),
    storageKeyPreview: varchar('storage_key_preview', { length: 500 }),
    storageKeyThumb: varchar('storage_key_thumb', { length: 500 }),

    capturedAt: timestamp('captured_at', { withTimezone: true }),
    tzOffsetMinutes: integer('tz_offset_minutes'),
    geom: geometryPoint('geom'),
    altitudeM: real('altitude_m'),
    orientation: integer('orientation'),
    cameraMake: varchar('camera_make', { length: 100 }),
    cameraModel: varchar('camera_model', { length: 100 }),
    exif: jsonb('exif').$type<Record<string, unknown>>(),

    locationSource: photoLocationSourceEnum('location_source').notNull().default('unresolved'),
    locationConfidence: confidenceEnum('location_confidence').notNull().default('inferred'),

    // Explicit AnyPgColumn return type breaks the journeys<->photos<->sections
    // circular type-inference cycle (see journeys.ts's coverPhotoId).
    sectionId: uuid('section_id').references((): AnyPgColumn => sections.id, { onDelete: 'set null' }),

    caption: text('caption'),
    isCover: boolean('is_cover').notNull().default(false),

    source: provenanceEnum('source').notNull().default('auto'),
    lockedFields: text('locked_fields').array().notNull().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('photos_journey_captured_idx').on(table.journeyId, table.capturedAt),
    index('photos_geom_idx').using('gist', table.geom),
    index('photos_section_id_idx').on(table.sectionId)
  ]
)
