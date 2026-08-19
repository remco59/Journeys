import { pgTable, pgEnum, uuid, real, integer, timestamp, text, index } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { sections } from './sections'
import { confidenceEnum, provenanceEnum } from './enums'
import { geometryLineString } from '../postgis'

export const traceTypeEnum = pgEnum('trace_type', ['travel', 'activity', 'unknown'])

export const transportModeEnum = pgEnum('transport_mode', [
  'walking',
  'cycling',
  'car',
  'train',
  'bus',
  'ferry',
  'flight',
  'unknown'
])

export const traces = pgTable(
  'traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    fromSectionId: uuid('from_section_id').references(() => sections.id, { onDelete: 'cascade' }),
    toSectionId: uuid('to_section_id').references(() => sections.id, { onDelete: 'cascade' }),
    // activityId added in Phase 8, once the activities table exists.
    type: traceTypeEnum('type').notNull().default('unknown'),
    transportMode: transportModeEnum('transport_mode').notNull().default('unknown'),
    geom: geometryLineString('geom'),
    confidence: confidenceEnum('confidence').notNull().default('inferred'),
    source: provenanceEnum('source').notNull().default('auto'),
    lockedFields: text('locked_fields').array().notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    distanceM: real('distance_m'),
    durationS: integer('duration_s'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('traces_journey_id_idx').on(table.journeyId),
    index('traces_geom_idx').using('gist', table.geom)
  ]
)
