import { describe, it, expect } from 'vitest'
import { buildSectionCandidates, type ClusterPoint, type GeocodeFn } from '../../server/domain/clustering/section-candidates'
import { dbscan } from '../../server/domain/clustering/dbscan'
import { splitIntoTemporalWindows } from '../../server/domain/clustering/temporal'
import { haversineMeters } from '../../server/domain/clustering/geo-math'

const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000
const DAY_ONE_START = new Date('2026-08-17T09:00:00Z').getTime()

// Milan Duomo-ish coordinates, jittered by a few metres.
const MILAN = { lat: 45.4642, lon: 9.19 }
// ~5km away — a second, clearly separate stop.
const COMO_LIKE = { lat: 45.4642, lon: 9.256 }

function jitter(base: { lat: number; lon: number }, metersLat: number, metersLon: number) {
  return { lat: base.lat + metersLat / 111_320, lon: base.lon + metersLon / (111_320 * Math.cos((base.lat * Math.PI) / 180)) }
}

/** Deterministic stub: locality is derived from a coarse grid so "same place" is predictable in tests. */
const gridGeocode: GeocodeFn = async (point) => {
  const cellLat = Math.round(point.lat * 500) // ~200m grid cells
  const cellLon = Math.round(point.lon * 500)
  return { name: `poi-${cellLat}-${cellLon}`, locality: `locality-${Math.round(point.lat * 100)}-${Math.round(point.lon * 100)}` }
}

describe('buildSectionCandidates', () => {
  it('separates two dense clusters ~5km apart into two sections', async () => {
    const points: ClusterPoint[] = [
      ...[0, 1, 2, 3].map((i) => ({ id: `m${i}`, ...jitter(MILAN, i * 10, i * 5), timestamp: DAY_ONE_START + i * MIN })),
      ...[0, 1, 2].map((i) => ({
        id: `c${i}`,
        ...jitter(COMO_LIKE, i * 10, i * 5),
        timestamp: DAY_ONE_START + 3 * HOUR + i * MIN
      }))
    ]

    const candidates = await buildSectionCandidates(points, gridGeocode)

    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.memberIds.sort()).toEqual(['m0', 'm1', 'm2', 'm3'])
    expect(candidates[1]!.memberIds.sort()).toEqual(['c0', 'c1', 'c2'])
  })

  it('grows a spread-out cluster to city scale when reverse geocoding confirms the same locality', async () => {
    // Two tight sub-clusters ~400m apart (beyond the 150m base radius) but
    // both resolving to the same locality — should merge into one section,
    // the way "Milan" needs a bigger effective radius than a single POI.
    const points: ClusterPoint[] = [
      ...[0, 1, 2].map((i) => ({ id: `a${i}`, ...jitter(MILAN, i * 5, 0), timestamp: DAY_ONE_START + i * MIN })),
      ...[0, 1, 2].map((i) => ({
        id: `b${i}`,
        ...jitter(MILAN, 400 + i * 5, 0),
        timestamp: DAY_ONE_START + 20 * MIN + i * MIN
      }))
    ]

    const sameLocality: GeocodeFn = async () => ({ name: 'somewhere in milan', locality: 'Milano' })
    const candidates = await buildSectionCandidates(points, sameLocality)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.memberIds).toHaveLength(6)
    // Merged span (~200m from centroid) is still under the 300m naming
    // threshold, so the more specific POI name wins over the locality.
    expect(candidates[0]!.placeName).toBe('somewhere in milan')
    expect(candidates[0]!.locality).toBe('Milano')
  })

  it('does NOT merge a spread-out cluster when reverse geocoding disagrees on locality', async () => {
    const points: ClusterPoint[] = [
      ...[0, 1, 2].map((i) => ({ id: `a${i}`, ...jitter(MILAN, i * 5, 0), timestamp: DAY_ONE_START + i * MIN })),
      ...[0, 1, 2].map((i) => ({
        id: `b${i}`,
        ...jitter(MILAN, 400 + i * 5, 0),
        timestamp: DAY_ONE_START + 20 * MIN + i * MIN
      }))
    ]

    // Fine-scale place differs from the coarse-scale place: e.g. two
    // distinct villages that only look "close" at city scale.
    let call = 0
    const disagreeingLocality: GeocodeFn = async () => {
      call++
      return call % 2 === 1 ? { name: 'village a', locality: 'Village A' } : { name: 'village b', locality: 'Village B' }
    }

    const candidates = await buildSectionCandidates(points, disagreeingLocality)
    expect(candidates.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps a singleton far-flung photo as its own low-confidence section instead of dropping it', async () => {
    const points: ClusterPoint[] = [
      { id: 'lone', lat: 46.5, lon: 10.4, timestamp: DAY_ONE_START }
    ]
    const candidates = await buildSectionCandidates(points, gridGeocode)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.memberIds).toEqual(['lone'])
    expect(candidates[0]!.confidence).toBe('low')
  })

  it('splits a return visit to the same coordinates hours apart into two sections', async () => {
    const points: ClusterPoint[] = [
      { id: 'morning0', ...MILAN, timestamp: DAY_ONE_START },
      { id: 'morning1', ...jitter(MILAN, 5, 0), timestamp: DAY_ONE_START + MIN },
      { id: 'evening0', ...jitter(MILAN, 2, 0), timestamp: DAY_ONE_START + 10 * HOUR },
      { id: 'evening1', ...jitter(MILAN, 8, 0), timestamp: DAY_ONE_START + 10 * HOUR + MIN }
    ]
    const candidates = await buildSectionCandidates(points, gridGeocode)

    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.memberIds.sort()).toEqual(['morning0', 'morning1'])
    expect(candidates[1]!.memberIds.sort()).toEqual(['evening0', 'evening1'])
  })

  it('assigns higher confidence to sections with more corroborating points', async () => {
    const points: ClusterPoint[] = [0, 1, 2, 3, 4].map((i) => ({
      id: `p${i}`,
      ...jitter(MILAN, i * 3, 0),
      timestamp: DAY_ONE_START + i * MIN
    }))
    const candidates = await buildSectionCandidates(points, gridGeocode)
    expect(candidates[0]!.confidence).toBe('high')
  })
})

describe('dbscan', () => {
  it('never labels a point as noise when minPts is 1', () => {
    const points = [{ x: 0 }, { x: 1000 }, { x: 2000 }]
    const labels = dbscan(points, { eps: 1, minPts: 1, distance: (a, b) => Math.abs(a.x - b.x) })
    expect(labels.every((l) => l >= 0)).toBe(true)
    expect(new Set(labels).size).toBe(3) // all far apart -> three separate singleton clusters
  })

  it('merges points transitively within eps (chain linking)', () => {
    const points = [{ x: 0 }, { x: 100 }, { x: 200 }] // each consecutive pair is 100 apart
    const labels = dbscan(points, { eps: 150, minPts: 1, distance: (a, b) => Math.abs(a.x - b.x) })
    expect(new Set(labels).size).toBe(1)
  })
})

describe('splitIntoTemporalWindows', () => {
  it('keeps a sparse but continuous visit in one window', () => {
    const items = [0, 15, 30, 45].map((m) => DAY_ONE_START + m * MIN)
    const windows = splitIntoTemporalWindows(items, (t) => t)
    expect(windows).toHaveLength(1)
  })

  it('splits on a large gap relative to the typical interval', () => {
    const items = [0, 5, 10, 15, 300].map((m) => DAY_ONE_START + m * MIN)
    const windows = splitIntoTemporalWindows(items, (t) => t)
    expect(windows.length).toBeGreaterThanOrEqual(2)
    expect(windows[windows.length - 1]).toEqual([DAY_ONE_START + 300 * MIN])
  })
})

describe('haversineMeters', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineMeters(MILAN, MILAN)).toBeCloseTo(0, 3)
  })

  it('is roughly symmetric', () => {
    const a = haversineMeters(MILAN, COMO_LIKE)
    const b = haversineMeters(COMO_LIKE, MILAN)
    expect(a).toBeCloseTo(b, 6)
  })

  it('matches the ~5km jump used in fixtures within a reasonable tolerance', () => {
    const d = haversineMeters(MILAN, COMO_LIKE)
    expect(d).toBeGreaterThan(4000)
    expect(d).toBeLessThan(6000)
  })
})
