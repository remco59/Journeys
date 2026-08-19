import { eq, and } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { traces, journeys } from '../../db/schema'
import { lineStringGeoJsonSelect } from '../../db/postgis'

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
