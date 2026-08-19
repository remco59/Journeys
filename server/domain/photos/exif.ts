import { ExifTool } from 'exiftool-vendored'
import tzlookup from 'tz-lookup'
import { DateTime } from 'luxon'

let instance: ExifTool | undefined

export function getExifTool(): ExifTool {
  if (!instance) {
    instance = new ExifTool({ maxProcs: 2 })
  }
  return instance
}

export async function closeExifTool(): Promise<void> {
  if (instance) {
    await instance.end()
    instance = undefined
  }
}

export type ExtractedPhotoMetadata = {
  capturedAt: Date | null
  tzOffsetMinutes: number | null
  lat: number | null
  lon: number | null
  altitudeM: number | null
  orientation: number | null
  cameraMake: string | null
  cameraModel: string | null
  raw: Record<string, unknown>
}

type LocalDateComponents = {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
}

function isLocalDateLike(value: unknown): value is LocalDateComponents {
  return (
    typeof value === 'object' &&
    value !== null &&
    'year' in value &&
    'month' in value &&
    'day' in value
  )
}

/**
 * Camera clocks are frequently wrong or left on the home timezone. We never
 * trust the camera's own offset (when it even has one) — if GPS is present,
 * timezone is derived from the coordinates instead. See architecture plan §26.
 */
export async function extractPhotoMetadata(filePath: string): Promise<ExtractedPhotoMetadata> {
  const tags = await getExifTool().read(filePath)

  const lat = typeof tags.GPSLatitude === 'number' ? tags.GPSLatitude : null
  const lon = typeof tags.GPSLongitude === 'number' ? tags.GPSLongitude : null
  const altitudeM = typeof tags.GPSAltitude === 'number' ? tags.GPSAltitude : null
  const orientation = typeof tags.Orientation === 'number' ? tags.Orientation : null
  const cameraMake = typeof tags.Make === 'string' ? tags.Make : null
  const cameraModel = typeof tags.Model === 'string' ? tags.Model : null

  const localDate = tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate

  let capturedAt: Date | null = null
  let tzOffsetMinutes: number | null = null

  if (isLocalDateLike(localDate)) {
    const components = {
      year: localDate.year,
      month: localDate.month,
      day: localDate.day,
      hour: localDate.hour ?? 0,
      minute: localDate.minute ?? 0,
      second: Math.floor(localDate.second ?? 0)
    }

    if (lat != null && lon != null) {
      const zone = tzlookup(lat, lon)
      const dt = DateTime.fromObject(components, { zone })
      if (dt.isValid) {
        capturedAt = dt.toJSDate()
        tzOffsetMinutes = dt.offset
      }
    } else {
      // No GPS to derive a real zone from: store the naive wall-clock time
      // as UTC. Absolute time may be wrong, but relative order across
      // photos from the same camera stays correct, which is what the
      // clustering pipeline (§09) actually depends on.
      const dt = DateTime.fromObject(components, { zone: 'utc' })
      if (dt.isValid) capturedAt = dt.toJSDate()
    }
  }

  return {
    capturedAt,
    tzOffsetMinutes,
    lat,
    lon,
    altitudeM,
    orientation,
    cameraMake,
    cameraModel,
    raw: tags as unknown as Record<string, unknown>
  }
}
