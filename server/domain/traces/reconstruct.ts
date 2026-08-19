import { haversineMeters, type LatLon } from '../clustering/geo-math'

export type GapPoint = LatLon & { timestamp: number }

export type TraceDraft = {
  type: 'travel' | 'unknown'
  geom: LatLon[]
  confidence: 'high' | 'medium' | 'low' | 'inferred'
  distanceM: number
  durationS: number
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

function pathDistanceMeters(points: LatLon[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1]!, points[i]!)
  return total
}

/**
 * Reconstructs the trace between two chronologically adjacent sections from
 * whatever photo points fall in the gap between them. Limited to the
 * "reconstructed short route" and "unknown gap" branches of §10's state
 * machine — the Timeline-movement and activity-track branches are added in
 * later phases, once those sources exist.
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
    return {
      type: 'travel',
      geom,
      confidence: 'medium',
      distanceM: pathDistanceMeters(geom),
      durationS
    }
  }

  const geom = curvedInterpolation(from, to)
  return {
    type: 'unknown',
    geom,
    confidence: 'inferred',
    distanceM: haversineMeters(from, to),
    durationS
  }
}
