import { XMLParser } from 'fast-xml-parser'
import { mapTcxSport } from './type-mapping'
import type { ActivityImporter, NormalizedActivity, NormalizedActivityPoint } from '../types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => ['Activity', 'Lap', 'Track', 'Trackpoint'].includes(name)
})

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : null
}

function parseTrackpoint(tp: Record<string, unknown>): NormalizedActivityPoint | null {
  const position = tp.Position as Record<string, unknown> | undefined
  const lat = num(position?.LatitudeDegrees)
  const lon = num(position?.LongitudeDegrees)
  if (lat == null || lon == null) return null

  const timeRaw = tp.Time
  const time = typeof timeRaw === 'string' ? new Date(timeRaw) : null

  const hr = (tp.HeartRateBpm as Record<string, unknown> | undefined)?.Value
  const extensions = tp.Extensions as Record<string, unknown> | undefined
  const tpx = (extensions?.TPX ?? extensions?.tpx) as Record<string, unknown> | undefined

  return {
    lat,
    lon,
    elevationM: num(tp.AltitudeMeters),
    time: time && !Number.isNaN(time.getTime()) ? time : null,
    heartRate: num(hr),
    cadence: num(tp.Cadence ?? tpx?.RunCadence ?? tpx?.Cadence),
    power: num(tpx?.Watts ?? tp.Watts)
  }
}

export class TcxImporter implements ActivityImporter {
  readonly sourceFormat = 'tcx' as const

  async parse(fileBuffer: Buffer): Promise<NormalizedActivity[]> {
    const doc = parser.parse(fileBuffer.toString('utf-8'))
    const rawActivities = (doc?.TrainingCenterDatabase?.Activities?.Activity as Record<string, unknown>[] | undefined) ?? []

    const activities: NormalizedActivity[] = []
    for (const activity of rawActivities) {
      const laps = (activity.Lap as Record<string, unknown>[] | undefined) ?? []
      const points = laps
        .flatMap((lap) => (lap.Track as Record<string, unknown>[] | undefined) ?? [])
        .flatMap((track) => (track.Trackpoint as Record<string, unknown>[] | undefined) ?? [])
        .map(parseTrackpoint)
        .filter((p): p is NormalizedActivityPoint => p !== null)

      if (points.length < 2) continue

      const sport = typeof activity['@_Sport'] === 'string' ? (activity['@_Sport'] as string) : undefined
      activities.push({
        title: sport ? `${sport} activity` : 'Imported activity',
        type: mapTcxSport(sport),
        points
      })
    }

    return activities
  }
}
