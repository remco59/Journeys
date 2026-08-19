import { customType } from 'drizzle-orm/pg-core'
import { sql, type SQL } from 'drizzle-orm'

export type GeoPoint = { lat: number; lon: number }

/**
 * geometry(Point,4326) column. Write path only: toDriver turns a {lat,lon}
 * into ST_MakePoint. Deliberately does NOT parse reads — node-postgres has
 * no built-in PostGIS decoder, so raw `.geom` values are opaque EWKB hex.
 * Read coordinates via explicit projections instead — see geoPointSelect().
 */
export const geometryPoint = customType<{ data: GeoPoint | null; driverData: unknown }>({
  dataType() {
    return 'geometry(Point,4326)'
  },
  toDriver(value): SQL {
    if (value == null) return sql`NULL`
    return sql`ST_SetSRID(ST_MakePoint(${value.lon}, ${value.lat}), 4326)`
  }
})

/** SQL fragment projecting a geometry column to {lon, lat} for use in a `.select()`. */
export function geoPointSelect(column: unknown) {
  return {
    lon: sql<number | null>`ST_X(${column})`,
    lat: sql<number | null>`ST_Y(${column})`
  }
}
