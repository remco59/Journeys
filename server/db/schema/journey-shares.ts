import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { users } from './users'

export const journeyShares = pgTable('journey_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
  // High-entropy (nanoid, 21 chars ≈ 124 bits) — the only externally exposed identifier for a shared journey (§19).
  token: varchar('token', { length: 32 }).notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true })
})
