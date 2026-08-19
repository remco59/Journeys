import { eq, and, gt, lt, ne, or, isNull, isNotNull } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, photos, traces } from '../../db/schema'
import { geoPointSelect } from '../../db/postgis'
import { reconstructTravelTrace, type GapPoint } from './reconstruct'
import { findTraceBetween, deleteOrphanedTraces } from './traces'
import { pickUnlockedFields } from '../provenance/locked-patch'

async function fetchOrderedSections(journeyId: string) {
  const db = useDb()
  const rows = await db
    .select({
      id: sections.id,
      arrivalAt: sections.arrivalAt,
      departureAt: sections.departureAt,
      ...geoPointSelect(sections.geom)
    })
    .from(sections)
    .where(eq(sections.journeyId, journeyId))
    .orderBy(sections.arrivalAt)

  return rows.filter((s) => s.lat != null && s.lon != null && s.arrivalAt != null && s.departureAt != null) as Array<{
    id: string
    arrivalAt: Date
    departureAt: Date
    lat: number
    lon: number
  }>
}

async function fetchGapPhotos(journeyId: string, fromSectionId: string, toSectionId: string, afterMs: number, beforeMs: number): Promise<GapPoint[]> {
  const db = useDb()
  const rows = await db
    .select({ capturedAt: photos.capturedAt, ...geoPointSelect(photos.geom) })
    .from(photos)
    .where(
      and(
        eq(photos.journeyId, journeyId),
        isNotNull(photos.geom),
        isNotNull(photos.capturedAt),
        gt(photos.capturedAt, new Date(afterMs)),
        lt(photos.capturedAt, new Date(beforeMs)),
        // NULL sectionId (never assigned) must count as "not this section" —
        // plain ne() would silently exclude those rows (NULL != x is UNKNOWN
        // in SQL, not true), dropping exactly the unsorted photos most
        // likely to be genuine en-route gap points.
        or(isNull(photos.sectionId), and(ne(photos.sectionId, fromSectionId), ne(photos.sectionId, toSectionId)))
      )
    )

  return rows
    .filter((r) => r.lat != null && r.lon != null && r.capturedAt != null)
    .map((r) => ({ lat: r.lat!, lon: r.lon!, timestamp: r.capturedAt!.getTime() }))
}

export type ReconstructJourneyResult = { tracesCreated: number; tracesUpdated: number }

/**
 * Recomputes the travel trace between every chronologically adjacent pair
 * of sections. Limited to the photo-point and unknown-gap branches of §10
 * (Timeline/activity branches arrive in later phases). Safe to call
 * repeatedly: an existing trace's locked fields are preserved exactly like
 * section/photo reprocessing (§12).
 */
export async function reconstructJourneyTraces(journeyId: string): Promise<ReconstructJourneyResult> {
  const db = useDb()
  const ordered = await fetchOrderedSections(journeyId)

  let tracesCreated = 0
  let tracesUpdated = 0
  const validPairKeys = new Set<string>()

  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i]!
    const to = ordered[i + 1]!
    validPairKeys.add(`${from.id}:${to.id}`)

    const gapPoints = await fetchGapPhotos(journeyId, from.id, to.id, from.departureAt.getTime(), to.arrivalAt.getTime())
    const draft = reconstructTravelTrace(
      { lat: from.lat, lon: from.lon, departureAt: from.departureAt.getTime() },
      { lat: to.lat, lon: to.lon, arrivalAt: to.arrivalAt.getTime() },
      gapPoints
    )

    const existing = await findTraceBetween(journeyId, from.id, to.id)

    const proposed = {
      type: draft.type,
      geom: draft.geom,
      confidence: draft.confidence,
      startedAt: from.departureAt,
      endedAt: to.arrivalAt,
      distanceM: draft.distanceM,
      durationS: Math.round(draft.durationS)
    }

    if (existing) {
      const patch = pickUnlockedFields(proposed, existing.lockedFields)
      if (Object.keys(patch).length > 0) {
        await db.update(traces).set({ ...patch, updatedAt: new Date() }).where(eq(traces.id, existing.id))
        tracesUpdated++
      }
    } else {
      await db.insert(traces).values({
        journeyId,
        fromSectionId: from.id,
        toSectionId: to.id,
        source: 'auto',
        ...proposed
      })
      tracesCreated++
    }
  }

  await deleteOrphanedTraces(journeyId, validPairKeys)
  return { tracesCreated, tracesUpdated }
}
