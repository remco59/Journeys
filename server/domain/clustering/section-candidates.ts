import { dbscan } from './dbscan'
import { splitIntoTemporalWindows } from './temporal'
import { haversineMeters, centroid, maxRadiusFromCentroidMeters, type LatLon } from './geo-math'

export type ClusterPoint = LatLon & { id: string; timestamp: number }

export type GeocodePlace = { name: string | null; locality: string | null }
export type GeocodeFn = (point: LatLon) => Promise<GeocodePlace | null>

export type SectionCandidate = {
  memberIds: string[]
  centroid: LatLon
  arrivalAt: number
  departureAt: number
  placeName: string
  locality: string | null
  confidence: 'high' | 'medium' | 'low' | 'inferred'
}

const BASE_EPS_M = 150
const COARSE_EPS_M = 2000
// A fast highway/rail leg connecting two stops shouldn't be merged into one
// giant "section" just because a coarser radius happens to span it.
const GROWTH_MAX_SPEED_MPS = 10 // ~36 km/h

function groupIndicesByLabel(labels: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>()
  labels.forEach((label, idx) => {
    if (label < 0) return // minPts=1 never produces noise, but guard anyway
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(idx)
  })
  return map
}

function impliedSpeedMps(points: ClusterPoint[]): number {
  if (points.length < 2) return 0
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  let distance = 0
  let durationMs = 0
  for (let i = 1; i < sorted.length; i++) {
    distance += haversineMeters(sorted[i - 1]!, sorted[i]!)
    durationMs += sorted[i]!.timestamp - sorted[i - 1]!.timestamp
  }
  if (durationMs <= 0) return 0
  return distance / (durationMs / 1000)
}

function memoizedGeocode(geocode: GeocodeFn) {
  const cache = new Map<string, Promise<GeocodePlace | null>>()
  return (point: LatLon) => {
    const key = `${point.lat.toFixed(3)},${point.lon.toFixed(3)}`
    if (!cache.has(key)) cache.set(key, geocode(point))
    return cache.get(key)!
  }
}

async function clusterWindow(points: ClusterPoint[], geocode: GeocodeFn): Promise<SectionCandidate[]> {
  if (points.length === 0) return []
  const distance = (a: ClusterPoint, b: ClusterPoint) => haversineMeters(a, b)

  const fineLabels = dbscan(points, { eps: BASE_EPS_M, minPts: 1, distance })
  const coarseLabels = dbscan(points, { eps: COARSE_EPS_M, minPts: 1, distance })
  const coarseGroups = groupIndicesByLabel(coarseLabels)
  const fineGroups = groupIndicesByLabel(fineLabels)

  // Resolve each fine group to a final grouping key. Fine groups that grow
  // into (and are place-confirmed by) the same coarse group share a key,
  // so they merge into one final section below.
  const finalKeyByFineLabel = new Map<number, string>()

  for (const [fineLabel, indices] of fineGroups) {
    const members = indices.map((i) => points[i]!)

    let finalKey = `fine:${fineLabel}`

    // DBSCAN clusters monotonically grow as eps grows, so every member of
    // this fine group shares the same coarse-scale label — checking one
    // member is enough. The real trigger for "consider growing" is whether
    // coarse clustering actually pulled in points beyond this fine group,
    // not whether this fine group's own span happens to be large (a
    // chained cluster of nearby points can already be spread out on its
    // own without anything else being nearby to merge with).
    const coarseLabel = coarseLabels[indices[0]!]!
    const coarseIndices = coarseGroups.get(coarseLabel)!
    if (coarseIndices.length > indices.length) {
      const coarseMembers = coarseIndices.map((i) => points[i]!)

      if (impliedSpeedMps(coarseMembers) <= GROWTH_MAX_SPEED_MPS) {
        const [finePlace, coarsePlace] = await Promise.all([
          geocode(centroid(members)),
          geocode(centroid(coarseMembers))
        ])
        const sameLocality =
          finePlace?.locality && coarsePlace?.locality && finePlace.locality === coarsePlace.locality
        if (sameLocality) {
          finalKey = `coarse:${coarseLabel}`
        }
      }
    }
    finalKeyByFineLabel.set(fineLabel, finalKey)
  }

  const finalGroups = new Map<string, ClusterPoint[]>()
  fineGroups.forEach((indices, fineLabel) => {
    const key = finalKeyByFineLabel.get(fineLabel)!
    const members = indices.map((i) => points[i]!)
    if (!finalGroups.has(key)) finalGroups.set(key, [])
    finalGroups.get(key)!.push(...members)
  })

  const candidates: SectionCandidate[] = []
  for (const members of finalGroups.values()) {
    const center = centroid(members)
    const span = maxRadiusFromCentroidMeters(members)
    const place = await geocode(center)

    const placeName = (span <= 300 ? place?.name : null) ?? place?.locality ?? 'Unknown location'
    const timestamps = members.map((m) => m.timestamp)

    candidates.push({
      memberIds: members.map((m) => m.id),
      centroid: center,
      arrivalAt: Math.min(...timestamps),
      departureAt: Math.max(...timestamps),
      placeName,
      locality: place?.locality ?? null,
      confidence: members.length >= 3 ? 'high' : members.length === 2 ? 'medium' : 'low'
    })
  }

  return candidates.sort((a, b) => a.arrivalAt - b.arrivalAt)
}

/**
 * Turns a flat, time-sorted set of geotagged points into candidate
 * sections: temporal windows first, then context-aware spatial clustering
 * within each window. See architecture plan §09.
 */
export async function buildSectionCandidates(points: ClusterPoint[], geocode: GeocodeFn): Promise<SectionCandidate[]> {
  const cachedGeocode = memoizedGeocode(geocode)
  const windows = splitIntoTemporalWindows(points, (p) => p.timestamp)
  const results: SectionCandidate[] = []
  for (const window of windows) {
    results.push(...(await clusterWindow(window, cachedGeocode)))
  }
  return results
}
