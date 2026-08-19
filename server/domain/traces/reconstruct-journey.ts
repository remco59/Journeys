import { eq, and, gt, lt, ne, or, isNull, isNotNull } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, photos, traces, activities } from '../../db/schema'
import { geoPointSelect, lineStringGeoJsonSelect } from '../../db/postgis'
import { reconstructTravelTrace, type GapPoint } from './reconstruct'
import { findTraceBetween, deleteOrphanedTraces } from './traces'
import { pickUnlockedFields } from '../provenance/locked-patch'
import type { LatLon } from '../clustering/geo-math'

// Allows a little slack between when photos were taken and when the GPS
// recording actually started/stopped — clocks and GPS locks aren't instant.
const ACTIVITY_OVERLAP_TOLERANCE_MS = 15 * 60 * 1000

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

async function findCoveringActivity(journeyId: string, afterMs: number, beforeMs: number) {
  const db = useDb()
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      startedAt: activities.startedAt,
      endedAt: activities.endedAt,
      distanceM: activities.distanceM,
      geomGeoJson: lineStringGeoJsonSelect(activities.geom)
    })
    .from(activities)
    .where(eq(activities.journeyId, journeyId))

  const gapStart = afterMs - ACTIVITY_OVERLAP_TOLERANCE_MS
  const gapEnd = beforeMs + ACTIVITY_OVERLAP_TOLERANCE_MS

  return rows.find((a) => a.startedAt.getTime() >= gapStart && a.endedAt.getTime() <= gapEnd) ?? null
}

function activityTypeToTransportMode(type: string): (typeof traces.$inferInsert)['transportMode'] {
  if (type === 'cycling') return 'cycling'
  if (type === 'running' || type === 'walking' || type === 'hiking') return 'walking'
  return 'unknown'
}

function geoJsonToLatLon(raw: string | null): LatLon[] | null {
  if (!raw) return null
  const parsed = JSON.parse(raw) as { coordinates: [number, number][] }
  return parsed.coordinates.map(([lon, lat]) => ({ lat, lon }))
}

export type ReconstructJourneyResult = { tracesCreated: number; tracesUpdated: number }

/**
 * Recomputes the trace between every chronologically adjacent pair of
 * sections. Checks for a covering GPX/TCX/FIT activity first (the
 * "observed route" branch of §10 — high confidence, the activity's own
 * track); falls back to the photo-point and unknown-gap branches otherwise.
 * The Timeline-movement branch arrives in Phase 10. Safe to call
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

    const coveringActivity = await findCoveringActivity(journeyId, from.departureAt.getTime(), to.arrivalAt.getTime())

    let proposed: Partial<typeof traces.$inferInsert>
    if (coveringActivity) {
      proposed = {
        type: 'activity',
        activityId: coveringActivity.id,
        transportMode: activityTypeToTransportMode(coveringActivity.type),
        geom: geoJsonToLatLon(coveringActivity.geomGeoJson),
        confidence: 'high',
        startedAt: coveringActivity.startedAt,
        endedAt: coveringActivity.endedAt,
        distanceM: coveringActivity.distanceM,
        durationS: Math.round((coveringActivity.endedAt.getTime() - coveringActivity.startedAt.getTime()) / 1000)
      }
    } else {
      const gapPoints = await fetchGapPhotos(journeyId, from.id, to.id, from.departureAt.getTime(), to.arrivalAt.getTime())
      const draft = reconstructTravelTrace(
        { lat: from.lat, lon: from.lon, departureAt: from.departureAt.getTime() },
        { lat: to.lat, lon: to.lon, arrivalAt: to.arrivalAt.getTime() },
        gapPoints
      )
      proposed = {
        type: draft.type,
        activityId: null,
        transportMode: 'unknown',
        geom: draft.geom,
        confidence: draft.confidence,
        startedAt: from.departureAt,
        endedAt: to.arrivalAt,
        distanceM: draft.distanceM,
        durationS: Math.round(draft.durationS)
      }
    }

    const existing = await findTraceBetween(journeyId, from.id, to.id)

    if (existing) {
      // Compare only the fields we can read back (geom is write-only via
      // our PostGIS customType) — on an unchanged input set this avoids
      // reporting a spurious update on every single rerun.
      const changed =
        existing.type !== proposed.type ||
        existing.transportMode !== proposed.transportMode ||
        existing.confidence !== proposed.confidence ||
        existing.activityId !== (proposed.activityId ?? null) ||
        existing.startedAt?.getTime() !== proposed.startedAt?.getTime() ||
        existing.endedAt?.getTime() !== proposed.endedAt?.getTime()

      if (changed) {
        const patch = pickUnlockedFields(proposed, existing.lockedFields)
        if (Object.keys(patch).length > 0) {
          await db.update(traces).set({ ...patch, updatedAt: new Date() }).where(eq(traces.id, existing.id))
          tracesUpdated++
        }
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
