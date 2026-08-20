import { pgTable, pgEnum, uuid, varchar, real, integer, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { sections } from './sections'
import { importFiles } from './imports'
import { photos } from './photos'
import { provenanceEnum } from './enums'
import { geometryLineString } from '../postgis'

export const activityTypeEnum = pgEnum('activity_type', [
  'cycling',
  'hiking',
  'running',
  'walking',
  'swimming',
  'other'
])

export const activitySourceFormatEnum = pgEnum('activity_source_format', ['gpx', 'tcx', 'fit'])

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
    rawImportFileId: uuid('raw_import_file_id').references(() => importFiles.id, { onDelete: 'set null' }),
    coverPhotoId: uuid('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),

    title: varchar('title', { length: 200 }).notNull(),
    type: activityTypeEnum('type').notNull().default('other'),
    sourceFormat: activitySourceFormatEnum('source_format').notNull(),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    distanceM: real('distance_m'),
    elevationGainM: real('elevation_gain_m'),
    elevationLossM: real('elevation_loss_m'),
    avgSpeedMps: real('avg_speed_mps'),

    // Simplified for map rendering — full-resolution points live in the
    // original uploaded file (rawImportFileId), always re-parseable.
    geom: geometryLineString('geom'),
    stats: jsonb('stats').$type<Record<string, unknown>>(),

    source: provenanceEnum('source').notNull().default('auto'),
    lockedFields: text('locked_fields').array().notNull().default([]),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('activities_journey_started_idx').on(table.journeyId, table.startedAt),
    index('activities_geom_idx').using('gist', table.geom)
  ]
)
