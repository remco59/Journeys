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
  return {
    name: `poi-${cellLat}-${cellLon}`,
    locality: `locality-${Math.round(point.lat * 100)}-${Math.round(point.lon * 100)}`,
    district: null
  }
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

    const sameLocality: GeocodeFn = async () => ({ name: 'somewhere in milan', locality: 'Milano', district: null })
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
    // distinct villages that only look "close" at city scale. Keyed off the
    // point itself (not call order) since real reverse geocoding is a pure
    // function of coordinates.
    const disagreeingLocality: GeocodeFn = async (point) => {
      const offsetMeters = (point.lat - MILAN.lat) * 111_320
      return offsetMeters < 200
        ? { name: 'village a', locality: 'Village A', district: null }
        : { name: 'village b', locality: 'Village B', district: null }
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

  it('splits a return visit to the same coordinates a day apart into two sections', async () => {
    const points: ClusterPoint[] = [
      { id: 'day1_0', ...MILAN, timestamp: DAY_ONE_START },
      { id: 'day1_1', ...jitter(MILAN, 5, 0), timestamp: DAY_ONE_START + MIN },
      // 20h later — same place identity, but a same-day merge cap shouldn't
      // reach across an overnight gap into a deliberate next-day return.
      { id: 'day2_0', ...jitter(MILAN, 2, 0), timestamp: DAY_ONE_START + 20 * HOUR },
      { id: 'day2_1', ...jitter(MILAN, 8, 0), timestamp: DAY_ONE_START + 20 * HOUR + MIN }
    ]
    const candidates = await buildSectionCandidates(points, gridGeocode)

    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.memberIds.sort()).toEqual(['day1_0', 'day1_1'])
    expect(candidates[1]!.memberIds.sort()).toEqual(['day2_0', 'day2_1'])
  })

  it('merges different-named stops within the same city into one section, spanning most of a day', async () => {
    // A town center visit, then (after a gap) a specific landmark a couple
    // km away — different POI names, but the same locality and well within
    // the same-day merge cap, the way a full day in Monza (town + racetrack
    // + hotel) should read as one "Monza" section, not several.
    const townCenter = { lat: 45.58, lon: 9.27 }
    const landmark = { lat: 45.615, lon: 9.29 } // ~4.5km away, still "Monza"
    const monzaGeocode: GeocodeFn = async (point) => {
      const nearLandmark = haversineMeters(point, landmark) < 500
      return nearLandmark
        ? { name: 'Autodromo Nazionale Monza', locality: 'Monza', district: null }
        : { name: 'Piazza Roma', locality: 'Monza', district: null }
    }

    const points: ClusterPoint[] = [
      ...[0, 1].map((i) => ({ id: `town${i}`, ...jitter(townCenter, i * 5, 0), timestamp: DAY_ONE_START + i * MIN })),
      ...[0, 1].map((i) => ({
        id: `landmark${i}`,
        ...jitter(landmark, i * 5, 0),
        timestamp: DAY_ONE_START + 9 * HOUR + i * MIN
      }))
    ]
    const candidates = await buildSectionCandidates(points, monzaGeocode)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.memberIds.sort()).toEqual(['landmark0', 'landmark1', 'town0', 'town1'])
    expect(candidates[0]!.placeName).toBe('Monza')
  })

  it('prefers a shared neighborhood/district name over the city when merging, and over the bare locality when naming', async () => {
    // Two POIs ~600m apart, both in the "San Siro" district of Milano — should
    // merge and be named after the neighborhood, not fall all the way back
    // to "Milano".
    const stadium = { lat: 45.478, lon: 9.124 }
    const museum = { lat: 45.483, lon: 9.122 } // ~600m away
    const sanSiroGeocode: GeocodeFn = async (point) => {
      const nearStadium = haversineMeters(point, stadium) < 200
      return nearStadium
        ? { name: 'Giuseppe Meazza Stadium', locality: 'Milano', district: 'San Siro' }
        : { name: 'Museo San Siro', locality: 'Milano', district: 'San Siro' }
    }

    const points: ClusterPoint[] = [
      ...[0, 1].map((i) => ({ id: `stadium${i}`, ...jitter(stadium, i * 5, 0), timestamp: DAY_ONE_START + i * MIN })),
      ...[0, 1].map((i) => ({
        id: `museum${i}`,
        ...jitter(museum, i * 5, 0),
        timestamp: DAY_ONE_START + 30 * MIN + i * MIN
      }))
    ]
    const candidates = await buildSectionCandidates(points, sanSiroGeocode)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.memberIds.sort()).toEqual(['museum0', 'museum1', 'stadium0', 'stadium1'])
    expect(candidates[0]!.placeName).toBe('San Siro')
  })

  it('merges the same-named place back together when a mid-visit gap splits it into two temporal windows', async () => {
    const points: ClusterPoint[] = [
      ...[0, 1].map((i) => ({ id: `early${i}`, ...jitter(MILAN, i * 5, 0), timestamp: DAY_ONE_START + i * MIN })),
      // A gap long enough to start a new temporal window (e.g. a meal with no photos), but well
      // under the same-place merge cap — this is still one visit, not a deliberate return trip.
      ...[0, 1].map((i) => ({
        id: `late${i}`,
        ...jitter(MILAN, i * 5, 0),
        timestamp: DAY_ONE_START + 2 * HOUR + i * MIN
      }))
    ]
    const candidates = await buildSectionCandidates(points, gridGeocode)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.memberIds.sort()).toEqual(['early0', 'early1', 'late0', 'late1'])
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
