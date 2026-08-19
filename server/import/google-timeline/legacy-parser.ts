import { numE7, parseGoogleTimestamp } from './shared'
import type { GoogleTimelineParser, NormalizedTimelineData, NormalizedTimelineMovement } from './types'

type PathPoint = { lat: number; lon: number; timestamp: Date }

/** Real per-point timestamps (simplifiedRawPath) earn high confidence; interpolated ones (waypointPath) only medium. */
function extractPathPoints(seg: Record<string, unknown>, startTime: Date, endTime: Date): { path: PathPoint[]; hasRealTimestamps: boolean } {
  const raw = (seg.simplifiedRawPath as Record<string, unknown> | undefined)?.points as Record<string, unknown>[] | undefined
  if (Array.isArray(raw) && raw.length > 0) {
    const path = raw
      .map((p): PathPoint | null => {
        const lat = numE7(p.latE7)
        const lon = numE7(p.lngE7)
        const timestamp = parseGoogleTimestamp(p.timestampMs ?? p.timestamp)
        if (lat == null || lon == null || !timestamp) return null
        return { lat, lon, timestamp }
      })
      .filter((p): p is PathPoint => p !== null)
    return { path, hasRealTimestamps: true }
  }

  // waypointPath has no per-point timestamps — interpolate evenly across the segment's duration.
  const waypoints = (seg.waypointPath as Record<string, unknown> | undefined)?.waypoints as Record<string, unknown>[] | undefined
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    const durationMs = endTime.getTime() - startTime.getTime()
    const path = waypoints
      .map((p, i): PathPoint | null => {
        const lat = numE7(p.latE7)
        const lon = numE7(p.lngE7)
        if (lat == null || lon == null) return null
        const t = waypoints.length > 1 ? i / (waypoints.length - 1) : 0
        return { lat, lon, timestamp: new Date(startTime.getTime() + t * durationMs) }
      })
      .filter((p): p is PathPoint => p !== null)
    return { path, hasRealTimestamps: false }
  }

  return { path: [], hasRealTimestamps: false }
}

/** The original "Semantic Location History" Takeout format: a flat `timelineObjects[]` array of placeVisit/activitySegment entries. */
export class GoogleTimelineLegacyParser implements GoogleTimelineParser {
  readonly name = 'google-timeline-legacy'

  canParse(doc: unknown): boolean {
    return typeof doc === 'object' && doc !== null && Array.isArray((doc as Record<string, unknown>).timelineObjects)
  }

  parse(doc: unknown): NormalizedTimelineData {
    const objects = (doc as Record<string, unknown>).timelineObjects as Record<string, unknown>[]
    const data: NormalizedTimelineData = { points: [], visits: [], movements: [] }

    for (const entry of objects) {
      if (entry.placeVisit) {
        const pv = entry.placeVisit as Record<string, unknown>
        const location = pv.location as Record<string, unknown> | undefined
        const duration = pv.duration as Record<string, unknown> | undefined
        const lat = numE7(location?.latitudeE7)
        const lon = numE7(location?.longitudeE7)
        const arrival = parseGoogleTimestamp(duration?.startTimestamp ?? duration?.startTimestampMs)
        const departure = parseGoogleTimestamp(duration?.endTimestamp ?? duration?.endTimestampMs)
        if (lat != null && lon != null && arrival && departure) {
          data.visits.push({
            centroid: { lat, lon },
            arrival,
            departure,
            placeNameHint: typeof location?.name === 'string' ? location.name : null,
            confidence: 'medium'
          })
        }
      } else if (entry.activitySegment) {
        const seg = entry.activitySegment as Record<string, unknown>
        const startLoc = seg.startLocation as Record<string, unknown> | undefined
        const endLoc = seg.endLocation as Record<string, unknown> | undefined
        const duration = seg.duration as Record<string, unknown> | undefined
        const startLat = numE7(startLoc?.latitudeE7)
        const startLon = numE7(startLoc?.longitudeE7)
        const endLat = numE7(endLoc?.latitudeE7)
        const endLon = numE7(endLoc?.longitudeE7)
        const startTime = parseGoogleTimestamp(duration?.startTimestamp ?? duration?.startTimestampMs)
        const endTime = parseGoogleTimestamp(duration?.endTimestamp ?? duration?.endTimestampMs)

        if (startLat != null && startLon != null && endLat != null && endLon != null && startTime && endTime) {
          const { path, hasRealTimestamps } = extractPathPoints(seg, startTime, endTime)
          const movement: NormalizedTimelineMovement = {
            startPoint: { lat: startLat, lon: startLon, timestamp: startTime },
            endPoint: { lat: endLat, lon: endLon, timestamp: endTime },
            path,
            transportModeHint: typeof seg.activityType === 'string' ? seg.activityType : null,
            confidence: path.length > 0 && hasRealTimestamps ? 'high' : 'medium'
          }
          data.movements.push(movement)
        }
      }
    }

    return data
  }
}
