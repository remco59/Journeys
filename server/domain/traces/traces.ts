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

/** A manual transport-mode edit locks the field and replaces the reason — it's no longer an estimate. */
export async function updateTraceTransportMode(trace: typeof traces.$inferSelect, transportMode: (typeof traces.$inferInsert)['transportMode']) {
  const db = useDb()
  const locks = new Set(trace.lockedFields)
  locks.add('transportMode')
  locks.add('transportModeReason')

  const [updated] = await db
    .update(traces)
    .set({
      transportMode,
      transportModeReason: 'Set manually',
      source: 'user_override',
      lockedFields: [...locks],
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
