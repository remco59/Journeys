import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { routeCache } from '../../db/schema'
import { serverConfig } from '../../config'
import { haversineMeters, type LatLon } from '../../domain/clustering/geo-math'

// 'bus' reuses the car profile — there's no dedicated public bus-routing
// service, and a bus otherwise follows the same road network a car does,
// which is a far better approximation than no route at all.
export type RoadMode = 'car' | 'cycling' | 'walking' | 'bus'
export type RoadRouteResult = { geom: LatLon[]; distanceM: number; reason: string }

// Public FOSSGIS-hosted OSRM demo instances (free, no key) — same trust
// tier as the Overpass/Photon lookups already used elsewhere. Each mode's
// base URL is independently configurable so a self-hoster can point them at
// their own dedicated OSRM containers (a typical self-hosted OSRM instance
// serves exactly one profile at its root, unlike the public demo's
// /routed-{car,bike,foot} path convention).
const PROFILES: Record<RoadMode, { osrmProfile: string; maxDistanceKm: number; reason: string }> = {
  car: { osrmProfile: 'driving', maxDistanceKm: 2000, reason: 'Routed by car along OpenStreetMap roads (OSRM)' },
  bus: { osrmProfile: 'driving', maxDistanceKm: 2000, reason: 'Routed along roads via OpenStreetMap (OSRM) — approximated using the car network, since buses follow ordinary roads' },
  cycling: { osrmProfile: 'bike', maxDistanceKm: 300, reason: 'Routed by bike along OpenStreetMap paths (OSRM)' },
  walking: { osrmProfile: 'foot', maxDistanceKm: 50, reason: 'Routed on foot along OpenStreetMap paths (OSRM)' }
}

function baseUrlFor(mode: RoadMode): string {
  if (mode === 'car' || mode === 'bus') return serverConfig.osrmCarBaseUrl
  if (mode === 'cycling') return serverConfig.osrmBikeBaseUrl
  return serverConfig.osrmFootBaseUrl
}

const CACHE_PRECISION = 3 // ~111m grid cells, matching geocode.ts's cache-key convention
const FOUND_TTL_DAYS = 90 // road networks change more often than rail, but still infrequently
const NOT_FOUND_TTL_DAYS = 14
const PROVIDER = 'osrm'

function cacheKeyFor(mode: RoadMode, from: LatLon, to: LatLon): string {
  const p = (v: number) => v.toFixed(CACHE_PRECISION)
  return `${mode}:${p(from.lat)},${p(from.lon)}->${p(to.lat)},${p(to.lon)}`
}

async function readCache(key: string, reason: string): Promise<{ found: false } | { found: true; result: RoadRouteResult } | null> {
  const db = useDb()
  const rows = await db.select().from(routeCache).where(and(eq(routeCache.provider, PROVIDER), eq(routeCache.cacheKey, key))).limit(1)
  const hit = rows[0]
  if (!hit || hit.expiresAt.getTime() <= Date.now()) return null
  if (hit.found === 'no' || !hit.geom || hit.distanceM == null) return { found: false }
  return { found: true, result: { geom: hit.geom, distanceM: hit.distanceM, reason } }
}

async function writeCache(key: string, result: RoadRouteResult | null): Promise<void> {
  const db = useDb()
  const ttlDays = result ? FOUND_TTL_DAYS : NOT_FOUND_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  await db
    .insert(routeCache)
    .values({ provider: PROVIDER, cacheKey: key, found: result ? 'yes' : 'no', geom: result?.geom ?? null, distanceM: result?.distanceM ?? null, expiresAt })
    .onConflictDoUpdate({
      target: [routeCache.provider, routeCache.cacheKey],
      set: { found: result ? 'yes' : 'no', geom: result?.geom ?? null, distanceM: result?.distanceM ?? null, expiresAt, createdAt: new Date() }
    })
}

type OsrmResponse = { code: string; routes?: { geometry: { coordinates: [number, number][] }; distance: number }[] }

/** Pure parser, exported for testing against a fixture response without a real network call. */
export function parseOsrmResponse(body: OsrmResponse, reason: string): RoadRouteResult | null {
  const route = body.code === 'Ok' ? body.routes?.[0] : undefined
  if (!route || !route.geometry?.coordinates?.length) return null
  return { geom: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), distanceM: route.distance, reason }
}

async function queryOsrm(mode: RoadMode, from: LatLon, to: LatLon): Promise<RoadRouteResult | null> {
  const profile = PROFILES[mode]
  const url = `${baseUrlFor(mode)}/route/v1/${profile.osrmProfile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
  const res = await fetch(url, {
    headers: { 'user-agent': 'journeys-self-hosted-app (road-route-lookup)' },
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) throw new Error(`OSRM ${mode} route query failed: ${res.status}`)
  const body = (await res.json()) as OsrmResponse
  return parseOsrmResponse(body, profile.reason)
}

/**
 * Finds a real driving/cycling/walking/bus route between two points via a
 * public OSRM instance. Cached (road networks change more often than rail,
 * but still rarely enough to be worth caching). Any failure — network
 * error, timeout, malformed response, no route found — resolves to null
 * rather than throwing; the caller decides what a null result means (it
 * should never just keep a previous mode's route geometry, which would
 * misleadingly show e.g. rail track for a trace now labeled "bus").
 */
export async function findRoadRoute(mode: RoadMode, from: LatLon, to: LatLon): Promise<RoadRouteResult | null> {
  const profile = PROFILES[mode]
  if (haversineMeters(from, to) > profile.maxDistanceKm * 1000) return null

  const key = cacheKeyFor(mode, from, to)
  try {
    const cached = await readCache(key, profile.reason)
    if (cached) return cached.found ? cached.result : null

    const result = await queryOsrm(mode, from, to)
    await writeCache(key, result)
    return result
  } catch {
    return null
  }
}
