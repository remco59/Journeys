import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { provenanceEnum, confidenceEnum } from './enums'
import { geometryPoint } from '../postgis'

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    placeName: varchar('place_name', { length: 300 }),
    description: text('description'),
    geom: geometryPoint('geom'),
    arrivalAt: timestamp('arrival_at', { withTimezone: true }).notNull(),
    departureAt: timestamp('departure_at', { withTimezone: true }),
    confidence: confidenceEnum('confidence').notNull().default('medium'),
    source: provenanceEnum('source').notNull().default('auto'),
    lockedFields: text('locked_fields').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('sections_journey_arrival_idx').on(table.journeyId, table.arrivalAt),
    index('sections_geom_idx').using('gist', table.geom)
  ]
)
