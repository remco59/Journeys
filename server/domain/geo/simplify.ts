import { haversineMeters, type LatLon } from '../clustering/geo-math'

function perpendicularDistanceMeters(point: LatLon, start: LatLon, end: LatLon): number {
  if (start.lat === end.lat && start.lon === end.lon) return haversineMeters(point, start)

  // Work in a locally-flat approximation (fine at the scale of a single
  // activity track) rather than true great-circle perpendicular distance —
  // simple, and accurate enough for a display-simplification threshold.
  const [x, y] = [point.lon, point.lat]
  const [x1, y1] = [start.lon, start.lat]
  const [x2, y2] = [end.lon, end.lat]

  const lineLenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2
  const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lineLenSq))
  const projected = { lat: y1 + t * (y2 - y1), lon: x1 + t * (x2 - x1) }
  return haversineMeters(point, projected)
}

/**
 * Douglas–Peucker simplification. Used to keep activity/trace geometries
 * small for map rendering without needing PostGIS round-trips — a
 * multi-thousand-point ride is reduced to a display-appropriate polyline
 * while preserving its overall shape. See architecture plan §14.
 */
export function simplifyPath(points: LatLon[], toleranceMeters: number): LatLon[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIndex = 0
  const start = points[0]!
  const end = points[points.length - 1]!

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistanceMeters(points[i]!, start, end)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (maxDist > toleranceMeters) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), toleranceMeters)
    const right = simplifyPath(points.slice(maxIndex), toleranceMeters)
    return [...left.slice(0, -1), ...right]
  }

  return [start, end]
}

/** Simplifies down to roughly a target point count by widening tolerance until it fits. */
export function simplifyToApproxCount(points: LatLon[], targetCount: number): LatLon[] {
  if (points.length <= targetCount) return points

  let tolerance = 5 // metres
  let result = points
  for (let i = 0; i < 12; i++) {
    result = simplifyPath(points, tolerance)
    if (result.length <= targetCount) break
    tolerance *= 1.8
  }
  return result
}
