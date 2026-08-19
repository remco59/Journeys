import { pgTable, pgEnum, uuid, real, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { imports } from './imports'
import { confidenceEnum } from './enums'
import { geometryPoint } from '../postgis'

export const observationSourceEnum = pgEnum('observation_source', [
  'photo',
  'timeline_point',
  'timeline_visit',
  'timeline_movement',
  'gpx',
  'tcx',
  'fit',
  'manual'
])

/**
 * Append-only normalized fact table — every parser writes into this and
 * nothing ever mutates a row. Reprocessing re-reads this table; it never
 * needs to re-parse source files. See architecture plan §06/§09.
 */
export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    importId: uuid('import_id').references(() => imports.id, { onDelete: 'set null' }),
    sourceType: observationSourceEnum('source_type').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    tzOffsetMinutes: integer('tz_offset_minutes'),
    geom: geometryPoint('geom'),
    altitudeM: real('altitude_m'),
    accuracyM: real('accuracy_m'),
    confidence: confidenceEnum('confidence').notNull().default('medium'),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('observations_journey_captured_idx').on(table.journeyId, table.capturedAt),
    index('observations_geom_idx').using('gist', table.geom)
  ]
)
