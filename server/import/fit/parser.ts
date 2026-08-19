import { Decoder, Stream } from '@garmin/fitsdk'
import { mapFitSport } from './type-mapping'
import type { ActivityImporter, NormalizedActivity, NormalizedActivityPoint } from '../types'

const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export class FitImporter implements ActivityImporter {
  readonly sourceFormat = 'fit' as const

  async parse(fileBuffer: Buffer): Promise<NormalizedActivity[]> {
    const stream = Stream.fromBuffer(fileBuffer)
    if (!Decoder.isFIT(stream)) {
      throw new Error('Not a valid FIT file')
    }

    const decoder = new Decoder(stream)
    // decoder.read() catches internal decode exceptions itself and reports
    // them via `errors` rather than throwing — a corrupt tail doesn't
    // prevent using whatever records did decode successfully.
    const { messages } = decoder.read()

    const records = (messages.recordMesgs as Record<string, unknown>[] | undefined) ?? []
    const points: NormalizedActivityPoint[] = records
      .map((r) => {
        const latRaw = num(r.positionLat)
        const lonRaw = num(r.positionLong)
        if (latRaw == null || lonRaw == null) return null
        return {
          lat: latRaw * SEMICIRCLE_TO_DEGREES,
          lon: lonRaw * SEMICIRCLE_TO_DEGREES,
          elevationM: num(r.altitude),
          time: r.timestamp instanceof Date ? r.timestamp : null,
          heartRate: num(r.heartRate),
          cadence: num(r.cadence),
          power: num(r.power)
        } satisfies NormalizedActivityPoint
      })
      .filter((p): p is NormalizedActivityPoint => p !== null)

    if (points.length < 2) return []

    const session = (messages.sessionMesgs as Record<string, unknown>[] | undefined)?.[0]
    const sportRaw = typeof session?.sport === 'string' ? session.sport : undefined
    const type = mapFitSport(sportRaw)

    return [
      {
        title: sportRaw ? `${capitalize(sportRaw)} activity` : 'Imported activity',
        type,
        points
      }
    ]
  }
}
