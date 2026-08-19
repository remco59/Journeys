/** Google's *E7 fields are the coordinate * 1e7, stored as an integer to avoid floating point in the export. */
export function numE7(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v / 1e7 : null
}

/** Handles both ISO-string and millisecond-since-epoch (sometimes stringified) timestamp fields Google has used. */
export function parseGoogleTimestamp(v: unknown): Date | null {
  if (typeof v === 'string') {
    if (/^\d+$/.test(v)) {
      const ms = Number(v)
      return Number.isFinite(ms) ? new Date(ms) : null
    }
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v)
  }
  return null
}

/** Parses the newer format's "45.1234°, 9.5678°" latLng string. */
export function parseDegreeLatLng(v: unknown): { lat: number; lon: number } | null {
  if (typeof v !== 'string') return null
  const parts = v.split(',').map((s) => Number.parseFloat(s.replace('°', '').trim()))
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
  return { lat: parts[0]!, lon: parts[1]! }
}
