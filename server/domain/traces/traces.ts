import { eq, and } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { traces, journeys, sections } from '../../db/schema'
import { lineStringGeoJsonSelect, geoPointSelect } from '../../db/postgis'
import { findFlightRoute } from '../../geo/route-lookup/flight-route'
import { findRailRoute } from '../../geo/route-lookup/rail-route'
import { findRoadRoute, type RoadMode } from '../../geo/route-lookup/road-route'
import { haversineMeters, type LatLon } from '../clustering/geo-math'

type GeoJsonLineString = { type: 'LineString'; coordinates: [number, number][] }

function parseGeom(raw: string | null): GeoJsonLineString | null {
  if (!raw) return null
  return JSON.parse(raw) as GeoJsonLineString
}

export async function listTracesForJourney(journeyId: string) {
  const db = useDb()
  const rows = await db
    .select({
      id: traces.id,
      journeyId: traces.journeyId,
      fromSectionId: traces.fromSectionId,
      toSectionId: traces.toSectionId,
      type: traces.type,
      transportMode: traces.transportMode,
      transportModeReason: traces.transportModeReason,
      confidence: traces.confidence,
      source: traces.source,
      lockedFields: traces.lockedFields,
      startedAt: traces.startedAt,
      endedAt: traces.endedAt,
      distanceM: traces.distanceM,
      durationS: traces.durationS,
      geomGeoJson: lineStringGeoJsonSelect(traces.geom)
    })
    .from(traces)
    .where(eq(traces.journeyId, journeyId))

  return rows.map((r) => ({ ...r, geom: parseGeom(r.geomGeoJson), geomGeoJson: undefined }))
}

export async function listTracesForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const owns = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.id, journeyId), eq(journeys.ownerId, ownerId))).limit(1)
  if (!owns[0]) return null
  return listTracesForJourney(journeyId)
}

export async function findTraceBetween(journeyId: string, fromSectionId: string, toSectionId: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(traces)
    .where(and(eq(traces.journeyId, journeyId), eq(traces.fromSectionId, fromSectionId), eq(traces.toSectionId, toSectionId)))
    .limit(1)
  return rows[0] ?? null
}

export async function getTraceForOwner(traceId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ trace: traces })
    .from(traces)
    .innerJoin(journeys, eq(traces.journeyId, journeys.id))
    .where(and(eq(traces.id, traceId), eq(journeys.ownerId, ownerId)))
    .limit(1)
  return rows[0]?.trace ?? null
}

const ROAD_MODES = new Set<string>(['car', 'bus', 'cycling', 'walking'])

async function sectionLatLon(sectionId: string | null): Promise<LatLon | null> {
  if (!sectionId) return null
  const db = useDb()
  const rows = await db.select(geoPointSelect(sections.geom)).from(sections).where(eq(sections.id, sectionId)).limit(1)
  const row = rows[0]
  return row && row.lat != null && row.lon != null ? { lat: row.lat, lon: row.lon } : null
}

/**
 * A manual transport-mode edit locks the field and replaces the reason —
 * it's no longer an estimate. Also re-snaps the trace's geometry to a real
 * route for the new mode (great-circle for flight, real track for train,
 * real road/path for car/bus/cycling/walking — bus reuses the car road
 * network, there being no dedicated public bus router), unless a recorded
 * GPX/TCX/FIT activity already covers this trace — real recorded GPS
 * always wins over any routed guess. A successful snap sets confidence to
 * "medium" — a real route, but not verified/recorded data, so it reads on
 * the map as "likely" (gold dashed) rather than "confirmed" (solid) or
 * "unsure" (dotted).
 *
 * When no lookup applies to the new mode (ferry, unsure) or the lookup
 * fails to find anything, the geometry is reset to a straight line between
 * the two endpoints rather than left as whatever it was before — otherwise
 * a trace changed from, say, train to bus would keep showing real rail
 * track under its new label, which reads as "the bus runs on train tracks."
 * A straight line makes "we don't have route data for this" honest instead.
 *
 * All touched fields are locked so a later reclustering run can't revert
 * any of it.
 */
export async function updateTraceTransportMode(trace: typeof traces.$inferSelect, transportMode: (typeof traces.$inferSelect)['transportMode']) {
  const db = useDb()
  const locks = new Set(trace.lockedFields)
  locks.add('transportMode')
  locks.add('transportModeReason')
  locks.add('geom')
  locks.add('distanceM')

  let transportModeReason = 'Set manually'
  let geom: LatLon[] | undefined
  let distanceM: number | undefined
  let confidence: (typeof traces.$inferSelect)['confidence'] | undefined

  const hasCoveringActivity = trace.type === 'activity' && trace.activityId != null
  if (!hasCoveringActivity) {
    const from = await sectionLatLon(trace.fromSectionId)
    const to = await sectionLatLon(trace.toSectionId)
    if (from && to) {
      const route = transportMode === 'flight'
        ? findFlightRoute(from, to)
        : transportMode === 'train'
          ? await findRailRoute(from, to)
          : ROAD_MODES.has(transportMode)
            ? await findRoadRoute(transportMode as RoadMode, from, to)
            : null

      if (route) {
        geom = route.geom
        distanceM = route.distanceM
        transportModeReason = route.reason
        confidence = 'medium'
        locks.add('confidence')
      } else {
        geom = [from, to]
        distanceM = haversineMeters(from, to)
        transportModeReason = 'Set manually — no route data available for this mode, showing a direct line'
        // Not "medium" (likely/gold) — a straight line with no real route
        // behind it is exactly the "unsure" case, styled stone-dotted.
        confidence = 'inferred'
        locks.add('confidence')
      }
    }
  }

  const [updated] = await db
    .update(traces)
    .set({
      transportMode,
      transportModeReason,
      source: 'user_override',
      lockedFields: [...locks],
      ...(geom ? { geom } : {}),
      ...(distanceM != null ? { distanceM } : {}),
      ...(confidence ? { confidence } : {}),
      updatedAt: new Date()
    })
    .where(eq(traces.id, trace.id))
    .returning()
  return updated!
}

/** Traces whose endpoint sections no longer exist as an adjacent pair — cleaned up after reconstruction. */
export async function deleteOrphanedTraces(journeyId: string, validPairKeys: Set<string>) {
  const db = useDb()
  const all = await db.select({ id: traces.id, fromSectionId: traces.fromSectionId, toSectionId: traces.toSectionId }).from(traces).where(eq(traces.journeyId, journeyId))
  for (const trace of all) {
    const key = `${trace.fromSectionId}:${trace.toSectionId}`
    if (!validPairKeys.has(key)) {
      await db.delete(traces).where(eq(traces.id, trace.id))
    }
  }
}
