import { eq, and } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { activities, journeys } from '../../db/schema'
import { lineStringGeoJsonSelect } from '../../db/postgis'
import { simplifyToApproxCount } from '../geo/simplify'
import { computeActivityStats } from './stats'
import type { NormalizedActivity } from '../../import/types'

const MAX_GEOM_POINTS = 300

export async function createActivityFromImport(
  journeyId: string,
  rawImportFileId: string,
  normalized: NormalizedActivity,
  sourceFormat: 'gpx' | 'tcx' | 'fit'
) {
  const stats = computeActivityStats(normalized.points)
  if (!stats) return null // no timestamps — can't place it in the Story

  const db = useDb()
  const simplified = simplifyToApproxCount(
    normalized.points.map((p) => ({ lat: p.lat, lon: p.lon })),
    MAX_GEOM_POINTS
  )

  const hasHr = normalized.points.some((p) => p.heartRate != null)
  const hasCadence = normalized.points.some((p) => p.cadence != null)
  const hasPower = normalized.points.some((p) => p.power != null)

  const [created] = await db
    .insert(activities)
    .values({
      journeyId,
      rawImportFileId,
      title: normalized.title,
      type: normalized.type,
      sourceFormat,
      startedAt: stats.startedAt,
      endedAt: stats.endedAt,
      distanceM: stats.distanceM,
      elevationGainM: stats.elevationGainM,
      elevationLossM: stats.elevationLossM,
      avgSpeedMps: stats.avgSpeedMps,
      geom: simplified.length >= 2 ? simplified : null,
      stats: { pointCount: normalized.points.length, hasHeartRate: hasHr, hasCadence, hasPower },
      source: 'auto'
    })
    .returning()

  return created!
}

function parseGeom(raw: string | null) {
  if (!raw) return null
  return JSON.parse(raw) as { type: 'LineString'; coordinates: [number, number][] }
}

export async function listActivitiesForJourney(journeyId: string) {
  const db = useDb()
  const rows = await db
    .select({
      id: activities.id,
      journeyId: activities.journeyId,
      sectionId: activities.sectionId,
      title: activities.title,
      type: activities.type,
      startedAt: activities.startedAt,
      endedAt: activities.endedAt,
      distanceM: activities.distanceM,
      elevationGainM: activities.elevationGainM,
      elevationLossM: activities.elevationLossM,
      avgSpeedMps: activities.avgSpeedMps,
      source: activities.source,
      lockedFields: activities.lockedFields,
      geomGeoJson: lineStringGeoJsonSelect(activities.geom)
    })
    .from(activities)
    .where(eq(activities.journeyId, journeyId))
    .orderBy(activities.startedAt)

  return rows.map((r) => ({ ...r, geom: parseGeom(r.geomGeoJson), geomGeoJson: undefined }))
}

export async function listActivitiesForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const owns = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.id, journeyId), eq(journeys.ownerId, ownerId))).limit(1)
  if (!owns[0]) return null
  return listActivitiesForJourney(journeyId)
}

/** Plain rows (startedAt/endedAt/type only) for trace-reconstruction matching — no need to decode geom there. */
export async function listActivityWindowsForJourney(journeyId: string) {
  const db = useDb()
  return db
    .select({ id: activities.id, type: activities.type, startedAt: activities.startedAt, endedAt: activities.endedAt })
    .from(activities)
    .where(eq(activities.journeyId, journeyId))
}
