import { pgTable, uuid, varchar, real, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'

/**
 * Reverse-geocoding cache, keyed by provider + rounded coordinates (~100m
 * cells at 3 decimal places) rather than a true geohash — simpler, and
 * sufficient for a personal-scale cache. See architecture plan §07.
 */
export const placeCache = pgTable(
  'place_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 40 }).notNull(),
    cacheKey: varchar('cache_key', { length: 60 }).notNull(),
    lat: real('lat').notNull(),
    lon: real('lon').notNull(),
    placeName: varchar('place_name', { length: 300 }),
    locality: varchar('locality', { length: 200 }),
    district: varchar('district', { length: 200 }),
    adminArea: varchar('admin_area', { length: 200 }),
    country: varchar('country', { length: 200 }),
    placeType: varchar('place_type', { length: 60 }),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
  },
  (table) => [unique('place_cache_provider_key_unique').on(table.provider, table.cacheKey)]
)
