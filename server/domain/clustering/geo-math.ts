export type LatLon = { lat: number; lon: number }

const EARTH_RADIUS_M = 6_371_000

export function haversineMeters(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function centroid(points: LatLon[]): LatLon {
  if (points.length === 0) throw new Error('centroid() requires at least one point')
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 })
  return { lat: sum.lat / points.length, lon: sum.lon / points.length }
}

/** Max distance from the centroid to any member point — a robust "how spread out is this cluster" metric. */
export function maxRadiusFromCentroidMeters(points: LatLon[]): number {
  const c = centroid(points)
  return Math.max(0, ...points.map((p) => haversineMeters(c, p)))
}

export function pathDistanceMeters(points: LatLon[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1]!, points[i]!)
  return total
}

/**
 * Spherical (great-circle) interpolation between two points — the geodesic
 * a flight actually follows, not a straight lat/lon lerp (which cuts the
 * wrong way on long east-west legs).
 */
export function greatCircleInterpolate(from: LatLon, to: LatLon, segments: number): LatLon[] {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const lat1 = toRad(from.lat)
  const lon1 = toRad(from.lon)
  const lat2 = toRad(to.lat)
  const lon2 = toRad(to.lon)

  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2))

  if (d === 0) return [{ ...from }, { ...to }]

  const points: LatLon[] = []
  for (let i = 0; i <= segments; i++) {
    const f = i / segments
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2)
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)
    const lat = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))
    const lon = Math.atan2(y, x)
    points.push({ lat: toDeg(lat), lon: toDeg(lon) })
  }
  return points
}
