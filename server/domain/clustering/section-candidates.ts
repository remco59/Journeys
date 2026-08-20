import { dbscan } from './dbscan'
import { splitIntoTemporalWindows } from './temporal'
import { haversineMeters, centroid, maxRadiusFromCentroidMeters, type LatLon } from './geo-math'

export type ClusterPoint = LatLon & { id: string; timestamp: number }

export type GeocodePlace = { name: string | null; locality: string | null; district: string | null }
export type GeocodeFn = (point: LatLon) => Promise<GeocodePlace | null>

export type SectionCandidate = {
  memberIds: string[]
  centroid: LatLon
  arrivalAt: number
  departureAt: number
  placeName: string
  locality: string | null
  /** Neighborhood/suburb, finer than locality — e.g. "San Siro" within "Milano". */
  district: string | null
  confidence: 'high' | 'medium' | 'low' | 'inferred'
}

const BASE_EPS_M = 150
// Real single stops can genuinely span kilometers (a racetrack, a museum
// campus) — this only grows a fine cluster if reverse geocoding also agrees
// the wider area shares a locality (see clusterWindow below), so a bigger
// radius mostly buys headroom rather than false merges.
const COARSE_EPS_M = 4000
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

    const placeName = (span <= 300 ? place?.name : null) ?? place?.district ?? place?.locality ?? 'Unknown location'
    const timestamps = members.map((m) => m.timestamp)

    candidates.push({
      memberIds: members.map((m) => m.id),
      centroid: center,
      arrivalAt: Math.min(...timestamps),
      departureAt: Math.max(...timestamps),
      placeName,
      locality: place?.locality ?? null,
      district: place?.district ?? null,
      confidence: members.length >= 3 ? 'high' : members.length === 2 ? 'medium' : 'low'
    })
  }

  return candidates.sort((a, b) => a.arrivalAt - b.arrivalAt)
}

// A gap this short between two same-place stops reads as one day in that
// area (a racetrack visit spanning town, corners, and hotel; a meal that
// split a museum visit into separate temporal windows), not a deliberate
// next-day return — merge those back together. Longer gaps keep sections
// separate even if the place identity matches.
const MAX_SAME_PLACE_MERGE_GAP_MS = 18 * 60 * 60 * 1000

type PlaceIdentity = { key: string; label: string }

/**
 * The identity two candidates are compared on when deciding whether they're
 * "the same stop": prefer the finest tier both sides actually have data for
 * — a neighborhood (San Siro), then a city/town (Monza), then falling back
 * to an exact POI name match for isolated spots with no locality data.
 * "Unknown location" never anchors a merge — that's a fallback name for
 * missing data, not evidence two stops are the same place.
 */
function placeIdentity(candidate: SectionCandidate): PlaceIdentity | null {
  if (candidate.district) return { key: `d:${candidate.district.trim().toLowerCase()}`, label: candidate.district }
  if (candidate.locality) return { key: `l:${candidate.locality.trim().toLowerCase()}`, label: candidate.locality }
  if (candidate.placeName !== 'Unknown location') {
    return { key: `n:${candidate.placeName.trim().toLowerCase()}`, label: candidate.placeName }
  }
  return null
}

function mergeCandidates(a: SectionCandidate, label: string, b: SectionCandidate): SectionCandidate {
  const memberIds = [...a.memberIds, ...b.memberIds]
  const weightA = a.memberIds.length
  const weightB = b.memberIds.length
  const total = weightA + weightB
  return {
    memberIds,
    centroid: {
      lat: (a.centroid.lat * weightA + b.centroid.lat * weightB) / total,
      lon: (a.centroid.lon * weightA + b.centroid.lon * weightB) / total
    },
    arrivalAt: Math.min(a.arrivalAt, b.arrivalAt),
    departureAt: Math.max(a.departureAt, b.departureAt),
    placeName: label,
    locality: a.locality ?? b.locality,
    district: a.district ?? b.district,
    confidence: memberIds.length >= 3 ? 'high' : memberIds.length === 2 ? 'medium' : 'low'
  }
}

/**
 * Adjacent temporal windows are clustered independently, so a single visit
 * spread across a wide area (a racetrack, a day wandering a city) surfaces
 * as several consecutive candidates that share a neighborhood or city even
 * though their specific POI names differ. Collapse those back into one
 * section — named after the shared neighborhood/city — rather than showing
 * a long run of narrowly-named stops down the timeline.
 */
function mergeAdjacentSamePlace(candidates: SectionCandidate[]): SectionCandidate[] {
  const merged: SectionCandidate[] = []
  const identities: PlaceIdentity[] = []
  for (const candidate of candidates) {
    const prev = merged[merged.length - 1]
    const prevIdentity = identities[identities.length - 1]
    const identity = placeIdentity(candidate)
    const sameStop =
      prev &&
      prevIdentity &&
      identity &&
      prevIdentity.key === identity.key &&
      candidate.arrivalAt - prev.departureAt <= MAX_SAME_PLACE_MERGE_GAP_MS
    if (prev && sameStop) {
      merged[merged.length - 1] = mergeCandidates(prev, prevIdentity!.label, candidate)
    } else {
      merged.push(candidate)
      identities.push(identity ?? { key: '', label: candidate.placeName })
    }
  }
  return merged
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
  return mergeAdjacentSamePlace(results)
}
