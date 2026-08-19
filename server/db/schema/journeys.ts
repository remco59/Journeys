import { pgTable, pgEnum, uuid, varchar, text, date, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './users'
import { photos } from './photos'

export const journeyVisibilityEnum = pgEnum('journey_visibility', ['private', 'shared'])

export const journeys = pgTable(
  'journeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    // Explicit AnyPgColumn return type breaks the journeys<->photos circular
    // type-inference cycle (both files reference each other's table).
    coverPhotoId: uuid('cover_photo_id').references((): AnyPgColumn => photos.id, { onDelete: 'set null' }),
    visibility: journeyVisibilityEnum('visibility').notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('journeys_owner_id_idx').on(table.ownerId)]
)
