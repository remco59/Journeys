import { pgTable, pgEnum, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'user'])
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system'])
export const distanceUnitEnum = pgEnum('distance_unit', ['km', 'mi'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  theme: themeEnum('theme').notNull().default('system'),
  distanceUnit: distanceUnitEnum('distance_unit').notNull().default('km'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
