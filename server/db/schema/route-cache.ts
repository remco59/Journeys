import { pgTable, uuid, varchar, real, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'

/**
 * Cache for looked-up route geometry (currently just Overpass rail routes —
 * the flight lookup is a local static dataset and needs no cache). Mirrors
 * place-cache.ts's provider + rounded-coordinate-key shape; Overpass is
 * rate-limited and rail networks change rarely, so entries live long.
 */
export const routeCache = pgTable(
  'route_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 40 }).notNull(),
    cacheKey: varchar('cache_key', { length: 80 }).notNull(),
    found: varchar('found', { length: 10 }).notNull(), // 'yes' | 'no' — negative results are cached too, briefly
    geom: jsonb('geom').$type<{ lat: number; lon: number }[] | null>(),
    distanceM: real('distance_m'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
  },
  (table) => [unique('route_cache_provider_key_unique').on(table.provider, table.cacheKey)]
)
