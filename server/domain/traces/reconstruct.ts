import { haversineMeters, pathDistanceMeters, type LatLon } from '../clustering/geo-math'

export type GapPoint = LatLon & { timestamp: number; source?: 'photo' | 'timeline'; transportModeHint?: string | null }

export type TraceDraft = {
  type: 'travel' | 'unknown'
  geom: LatLon[]
  confidence: 'high' | 'medium' | 'low' | 'inferred'
  distanceM: number
  durationS: number
  transportModeHint: string | null
}

const MAX_GAP_MINUTES_PER_POINT = 10

/**
 * Quadratic-Bézier curve between two points, offset perpendicular to the
 * straight line so it visually reads as "path unknown" rather than looking
 * like a real route. See architecture plan §10.
 */
function curvedInterpolation(from: LatLon, to: LatLon, segments = 24): LatLon[] {
  const mid = { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 }
  const dLat = to.lat - from.lat
  const dLon = to.lon - from.lon
  const straightLineDeg = Math.hypot(dLat, dLon)

  // Perpendicular direction, offset scaled to the leg's length (in degrees)
  // so short and long gaps both get a visible but proportionate curve.
  const perp = { lat: -dLon, lon: dLat }
  const perpLen = Math.hypot(perp.lat, perp.lon) || 1
  const offset = straightLineDeg * 0.15
  const control = {
    lat: mid.lat + (perp.lat / perpLen) * offset,
    lon: mid.lon + (perp.lon / perpLen) * offset
  }

  const points: LatLon[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    points.push({
      lat: (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * control.lat + t ** 2 * to.lat,
      lon: (1 - t) ** 2 * from.lon + 2 * (1 - t) * t * control.lon + t ** 2 * to.lon
    })
  }
  return points
}

/**
 * Reconstructs the trace between two chronologically adjacent sections from
 * whatever points fall in the gap between them — photo GPS and, once
 * imported, Google Timeline observations (§10's "reconstructed short
 * route" and "unknown gap" branches; activity tracks are handled upstream
 * in reconstruct-journey.ts). Timeline points are deliberate, continuous
 * GPS recording rather than incidental photo locations, so a dense gap
 * with any Timeline support earns high confidence instead of medium.
 */
export function reconstructTravelTrace(
  from: LatLon & { departureAt: number },
  to: LatLon & { arrivalAt: number },
  gapPoints: GapPoint[]
): TraceDraft {
  const durationS = Math.max(0, (to.arrivalAt - from.departureAt) / 1000)
  const sorted = [...gapPoints].sort((a, b) => a.timestamp - b.timestamp)

  const gapMinutes = durationS / 60
  const intervalCount = sorted.length + 1
  const avgIntervalMinutes = gapMinutes / intervalCount

  const denseEnough = sorted.length > 0 && avgIntervalMinutes <= MAX_GAP_MINUTES_PER_POINT

  if (denseEnough) {
    const geom: LatLon[] = [{ lat: from.lat, lon: from.lon }, ...sorted.map((p) => ({ lat: p.lat, lon: p.lon })), { lat: to.lat, lon: to.lon }]
    const hasTimelineSupport = sorted.some((p) => p.source === 'timeline')
    return {
      type: 'travel',
      geom,
      confidence: hasTimelineSupport ? 'high' : 'medium',
      distanceM: pathDistanceMeters(geom),
      durationS,
      transportModeHint: dominantTransportHint(sorted)
    }
  }

  const geom = curvedInterpolation(from, to)
  return {
    type: 'unknown',
    geom,
    confidence: 'inferred',
    distanceM: haversineMeters(from, to),
    durationS,
    transportModeHint: null
  }
}

/** The most common non-null transport hint among the gap's Timeline-sourced points, if any agree. */
function dominantTransportHint(points: GapPoint[]): string | null {
  const counts = new Map<string, number>()
  for (const p of points) {
    if (!p.transportModeHint) continue
    counts.set(p.transportModeHint, (counts.get(p.transportModeHint) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}
