import { haversineMeters, type LatLon } from '../../domain/clustering/geo-math'
// Imported as a module, not read from disk at runtime: this code runs both
// inside Nitro's bundled server (web) and the separately-run, unbundled
// worker process (see config.ts's comment on the same split) — a plain
// `import` is the one loading strategy both bundlers and plain Node handle
// identically, unlike a path built from import.meta.url, which only
// resolves correctly when the file ships unbundled next to the source.
import airportsData from './data/airports.json'

export type Airport = { iata: string; name: string; lat: number; lon: number; country: string }

/**
 * Airports with scheduled commercial service (OurAirports, public domain),
 * filtered to large/medium fields with an IATA code — a few thousand rows,
 * bundled at build time so airport lookups need no network call.
 */
export function loadAirports(): Airport[] {
  return airportsData as Airport[]
}

/** Nearest airport to a point within maxDistanceKm among the given list, or null if none qualify. Exported standalone so tests can pass a small fixture instead of the full bundled dataset. */
export function findNearestAirportIn(airports: Airport[], point: LatLon, maxDistanceKm: number): Airport | null {
  let best: Airport | null = null
  let bestDistanceM = Infinity

  for (const airport of airports) {
    const d = haversineMeters(point, airport)
    if (d < bestDistanceM) {
      bestDistanceM = d
      best = airport
    }
  }

  return best && bestDistanceM <= maxDistanceKm * 1000 ? best : null
}
