import { XMLParser } from 'fast-xml-parser'
import { mapGpxActivityType } from './type-mapping'
import type { ActivityImporter, NormalizedActivity, NormalizedActivityPoint } from '../types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // GPX extension namespaces vary by exporter (Garmin/Strava/etc) — normalize them away
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name)
})

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : null
}

function parseTrkpt(pt: Record<string, unknown>): NormalizedActivityPoint | null {
  const lat = num(pt['@_lat'])
  const lon = num(pt['@_lon'])
  if (lat == null || lon == null) return null

  const ext = (pt.extensions as Record<string, unknown> | undefined)?.TrackPointExtension as
    | Record<string, unknown>
    | undefined

  const timeRaw = pt.time
  const time = typeof timeRaw === 'string' ? new Date(timeRaw) : null

  return {
    lat,
    lon,
    elevationM: num(pt.ele),
    time: time && !Number.isNaN(time.getTime()) ? time : null,
    heartRate: num(ext?.hr),
    cadence: num(ext?.cad),
    power: num(pt.power ?? ext?.power)
  }
}

export class GpxImporter implements ActivityImporter {
  readonly sourceFormat = 'gpx' as const

  async parse(fileBuffer: Buffer): Promise<NormalizedActivity[]> {
    const doc = parser.parse(fileBuffer.toString('utf-8'))
    const tracks = (doc?.gpx?.trk as Record<string, unknown>[] | undefined) ?? []

    const activities: NormalizedActivity[] = []
    for (const trk of tracks) {
      const segments = (trk.trkseg as Record<string, unknown>[] | undefined) ?? []
      const points = segments
        .flatMap((seg) => (seg.trkpt as Record<string, unknown>[] | undefined) ?? [])
        .map(parseTrkpt)
        .filter((p): p is NormalizedActivityPoint => p !== null)

      if (points.length < 2) continue // not enough to form a track

      activities.push({
        title: typeof trk.name === 'string' ? trk.name : 'Imported activity',
        type: mapGpxActivityType(typeof trk.type === 'string' ? trk.type : undefined),
        points
      })
    }

    return activities
  }
}
