import { numE7, parseGoogleTimestamp } from './shared'
import type { GoogleTimelineParser, NormalizedTimelineData, NormalizedTimelinePoint } from './types'

/** Raw "Records.json" location-history export: a flat `locations[]` array of GPS pings, no semantic structure at all. */
export class GoogleTimelineRecordsParser implements GoogleTimelineParser {
  readonly name = 'google-timeline-records'

  canParse(doc: unknown): boolean {
    return typeof doc === 'object' && doc !== null && Array.isArray((doc as Record<string, unknown>).locations)
  }

  parse(doc: unknown): NormalizedTimelineData {
    const locations = (doc as Record<string, unknown>).locations as Record<string, unknown>[]

    const points = locations
      .map((loc): NormalizedTimelinePoint | null => {
        const lat = numE7(loc.latitudeE7)
        const lon = numE7(loc.longitudeE7)
        const timestamp = parseGoogleTimestamp(loc.timestamp ?? loc.timestampMs)
        if (lat == null || lon == null || !timestamp) return null

        const accuracyM = typeof loc.accuracy === 'number' ? loc.accuracy : null
        return {
          timestamp,
          lat,
          lon,
          accuracyM,
          confidence: accuracyM != null && accuracyM <= 50 ? 'high' : 'medium'
        }
      })
      .filter((p): p is NormalizedTimelinePoint => p !== null)

    return { points, visits: [], movements: [] }
  }
}
