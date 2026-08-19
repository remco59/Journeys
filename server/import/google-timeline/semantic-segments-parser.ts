import { parseDegreeLatLng } from './shared'
import type { GoogleTimelineParser, NormalizedTimelineData, NormalizedTimelinePoint } from './types'

function parseIso(v: unknown): Date | null {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The current (2023+) per-export "semanticSegments[]" format — a structural
 * rewrite of the legacy Takeout shape, not just renamed fields (camelCase
 * "45.1234°, 9.5678°" latLng strings instead of *E7 integers, ISO
 * start/end times instead of a nested duration object). `timelinePath`
 * entries are the richest source here: real per-point GPS with timestamps.
 */
export class GoogleTimelineSemanticSegmentsParser implements GoogleTimelineParser {
  readonly name = 'google-timeline-semantic-segments'

  canParse(doc: unknown): boolean {
    return typeof doc === 'object' && doc !== null && Array.isArray((doc as Record<string, unknown>).semanticSegments)
  }

  parse(doc: unknown): NormalizedTimelineData {
    const segments = (doc as Record<string, unknown>).semanticSegments as Record<string, unknown>[]
    const data: NormalizedTimelineData = { points: [], visits: [], movements: [] }

    for (const seg of segments) {
      const startTime = parseIso(seg.startTime)
      const endTime = parseIso(seg.endTime)

      if (seg.visit && startTime && endTime) {
        const visit = seg.visit as Record<string, unknown>
        const candidate = visit.topCandidate as Record<string, unknown> | undefined
        const placeLocation = candidate?.placeLocation as Record<string, unknown> | undefined
        const centroid = parseDegreeLatLng(placeLocation?.latLng)
        if (centroid) {
          data.visits.push({ centroid, arrival: startTime, departure: endTime, placeNameHint: null, confidence: 'medium' })
        }
      } else if (seg.activity && startTime && endTime) {
        const activity = seg.activity as Record<string, unknown>
        const start = parseDegreeLatLng((activity.start as Record<string, unknown> | undefined)?.latLng)
        const end = parseDegreeLatLng((activity.end as Record<string, unknown> | undefined)?.latLng)
        const candidate = activity.topCandidate as Record<string, unknown> | undefined
        if (start && end) {
          data.movements.push({
            startPoint: { ...start, timestamp: startTime },
            endPoint: { ...end, timestamp: endTime },
            path: [],
            transportModeHint: typeof candidate?.type === 'string' ? candidate.type : null,
            confidence: 'medium'
          })
        }
      }

      if (Array.isArray(seg.timelinePath)) {
        const pathPoints = (seg.timelinePath as Record<string, unknown>[])
          .map((p): NormalizedTimelinePoint | null => {
            const latlng = parseDegreeLatLng(p.point)
            const time = parseIso(p.time)
            if (!latlng || !time) return null
            return { timestamp: time, lat: latlng.lat, lon: latlng.lon, accuracyM: null, confidence: 'high' }
          })
          .filter((p): p is NormalizedTimelinePoint => p !== null)
        data.points.push(...pathPoints)
      }
    }

    return data
  }
}
