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
