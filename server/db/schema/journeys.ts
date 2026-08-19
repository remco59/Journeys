import { pgTable, pgEnum, uuid, varchar, text, date, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

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
    // No FK yet: photos doesn't exist until Phase 3, which adds the constraint.
    coverPhotoId: uuid('cover_photo_id'),
    visibility: journeyVisibilityEnum('visibility').notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('journeys_owner_id_idx').on(table.ownerId)]
)
