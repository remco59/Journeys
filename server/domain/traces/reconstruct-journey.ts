import { eq, and, gt, lt, ne, or, inArray, isNull, isNotNull } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, photos, traces, activities, observations } from '../../db/schema'
import { geoPointSelect, lineStringGeoJsonSelect } from '../../db/postgis'
import { reconstructTravelTrace, type GapPoint } from './reconstruct'
import { findTraceBetween, deleteOrphanedTraces } from './traces'
import { pickUnlockedFields } from '../provenance/locked-patch'
import { mapTransportHint } from './transport-hints'
import { inferTransportFromSpeed } from './transport-inference'
import { findFlightRoute } from '../../geo/route-lookup/flight-route'
import { findRailRoute } from '../../geo/route-lookup/rail-route'
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
    .map((r) => ({ lat: r.lat!, lon: r.lon!, timestamp: r.capturedAt!.getTime(), source: 'photo' as const }))
}

async function fetchGapTimelinePoints(journeyId: string, afterMs: number, beforeMs: number): Promise<GapPoint[]> {
  const db = useDb()
  const rows = await db
    .select({ capturedAt: observations.capturedAt, rawData: observations.rawData, ...geoPointSelect(observations.geom) })
    .from(observations)
    .where(
      and(
        eq(observations.journeyId, journeyId),
        inArray(observations.sourceType, ['timeline_point', 'timeline_movement']),
        isNotNull(observations.geom),
        gt(observations.capturedAt, new Date(afterMs)),
        lt(observations.capturedAt, new Date(beforeMs))
      )
    )

  return rows
    .filter((r) => r.lat != null && r.lon != null)
    .map((r) => ({
      lat: r.lat!,
      lon: r.lon!,
      timestamp: r.capturedAt.getTime(),
      source: 'timeline' as const,
      transportModeHint: (r.rawData as { transportModeHint?: string } | null)?.transportModeHint ?? null
    }))
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
  return 'unsure'
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
 * track); otherwise reconstructs from whatever points fall in the gap,
 * merging photo GPS with any imported Google Timeline observations (which,
 * being deliberate continuous recording rather than incidental photo
 * locations, can push a dense gap's confidence to "high" and contribute a
 * transport-mode hint — see reconstruct.ts). Safe to call repeatedly: an
 * existing trace's locked fields are preserved exactly like section/photo
 * reprocessing (§12).
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
        transportModeReason: `Recorded via a ${coveringActivity.type} activity import`,
        geom: geoJsonToLatLon(coveringActivity.geomGeoJson),
        confidence: 'high',
        startedAt: coveringActivity.startedAt,
        endedAt: coveringActivity.endedAt,
        distanceM: coveringActivity.distanceM,
        durationS: Math.round((coveringActivity.endedAt.getTime() - coveringActivity.startedAt.getTime()) / 1000)
      }
    } else {
      const gapStart = from.departureAt.getTime()
      const gapEnd = to.arrivalAt.getTime()
      const [gapPhotos, gapTimelinePoints] = await Promise.all([
        fetchGapPhotos(journeyId, from.id, to.id, gapStart, gapEnd),
        fetchGapTimelinePoints(journeyId, gapStart, gapEnd)
      ])
      const draft = reconstructTravelTrace(
        { lat: from.lat, lon: from.lon, departureAt: gapStart },
        { lat: to.lat, lon: to.lon, arrivalAt: gapEnd },
        [...gapPhotos, ...gapTimelinePoints]
      )

      // Timeline's own hint outranks a bare speed guess; fall back to the
      // rule-based estimate whenever nothing else resolved a mode. Sparse
      // ("unknown" type) gaps still have a valid endpoint distance/duration
      // — and that's exactly the shape of a real flight leg (no in-flight
      // photos, phone in airplane mode) — so this now runs for both gap
      // shapes; the flight thresholds have enough margin over ordinary
      // dwell time that this doesn't meaningfully risk false positives.
      let transportMode = mapTransportHint(draft.transportModeHint)
      let transportModeReason: string | null = draft.transportModeHint ? `From Google Timeline (${draft.transportModeHint})` : null
      let modeFromSpeedGuess = false
      if (transportMode === 'unsure') {
        const inferred = inferTransportFromSpeed(draft.distanceM, draft.durationS)
        transportMode = inferred.mode
        transportModeReason = inferred.reason
        modeFromSpeedGuess = true
      }

      let geom = draft.geom
      let distanceM = draft.distanceM
      let confidence = draft.confidence

      // Real route lookup only applies to sparse gaps: a dense ("travel")
      // gap already has an actual reconstructed polyline from real photo/
      // Timeline points, which beats any snapped idealization. A "car" mode
      // only gets a rail tie-breaker when it came from the ambiguous
      // speed-guess band (which already admits it could be a train) — not
      // when Timeline explicitly said driving.
      if (draft.type === 'unknown') {
        try {
          if (transportMode === 'flight') {
            const flightRoute = findFlightRoute(from, to)
            if (flightRoute) {
              geom = flightRoute.geom
              distanceM = flightRoute.distanceM
              transportModeReason = flightRoute.reason
              confidence = 'medium'
            }
          } else if (transportMode === 'train' || (transportMode === 'car' && modeFromSpeedGuess)) {
            const railRoute = await findRailRoute(from, to)
            if (railRoute) {
              transportMode = 'train'
              confidence = 'medium'
              geom = railRoute.geom
              distanceM = railRoute.distanceM
              transportModeReason = railRoute.reason
            }
          }
        } catch {
          // A lookup failure just skips enrichment — never break clustering.
        }
      }

      proposed = {
        type: draft.type,
        activityId: null,
        transportMode,
        transportModeReason,
        geom,
        confidence,
        startedAt: from.departureAt,
        endedAt: to.arrivalAt,
        distanceM,
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
        existing.transportModeReason !== (proposed.transportModeReason ?? null) ||
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
