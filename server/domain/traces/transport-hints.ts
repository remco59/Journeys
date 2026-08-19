import type { traces } from '../../db/schema'

type TransportMode = (typeof traces.$inferInsert)['transportMode']

// Google Timeline's activityType/topCandidate.type values, across both the
// legacy (SCREAMING_SNAKE_CASE) and current (lowercase) export shapes.
const HINT_MAP: Record<string, TransportMode> = {
  walking: 'walking',
  on_foot: 'walking',
  cycling: 'cycling',
  in_bus: 'bus',
  bus: 'bus',
  in_train: 'train',
  train: 'train',
  rail: 'train',
  in_subway: 'train',
  in_tram: 'train',
  in_passenger_vehicle: 'car',
  in_vehicle: 'car',
  driving: 'car',
  motorcycling: 'car',
  flying: 'flight',
  in_ferry: 'ferry',
  ferry: 'ferry'
}

/** Maps a raw Timeline transport hint (any casing/spacing) to our transportMode enum, or 'unknown' if unrecognized. */
export function mapTransportHint(raw: string | null | undefined): TransportMode {
  if (!raw) return 'unknown'
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return HINT_MAP[key] ?? 'unknown'
}
