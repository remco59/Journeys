import { describe, it, expect } from 'vitest'
import { greatCircleInterpolate, haversineMeters, pathDistanceMeters } from '../../server/domain/clustering/geo-math'

describe('greatCircleInterpolate', () => {
  it('starts and ends exactly at the given points', () => {
    const from = { lat: 52.3105, lon: 4.7683 } // Amsterdam
    const to = { lat: 40.6413, lon: -73.7781 } // JFK
    const points = greatCircleInterpolate(from, to, 10)
    expect(points[0]!.lat).toBeCloseTo(from.lat, 6)
    expect(points[0]!.lon).toBeCloseTo(from.lon, 6)
    expect(points[points.length - 1]!.lat).toBeCloseTo(to.lat, 6)
    expect(points[points.length - 1]!.lon).toBeCloseTo(to.lon, 6)
  })

  it('bulges toward the pole on a long east-west leg, unlike a naive lat/lon lerp', () => {
    // Two points on the same latitude, far apart in longitude — the great
    // circle between them passes noticeably north of that latitude.
    const from = { lat: 51, lon: -3 } // near London
    const to = { lat: 51, lon: 139 } // near Tokyo
    const points = greatCircleInterpolate(from, to, 20)
    const mid = points[10]!
    expect(mid.lat).toBeGreaterThan(51)
  })

  it('produces segments + 1 points', () => {
    const points = greatCircleInterpolate({ lat: 0, lon: 0 }, { lat: 10, lon: 10 }, 24)
    expect(points).toHaveLength(25)
  })

  it('handles identical endpoints without dividing by zero', () => {
    const p = { lat: 45, lon: 9 }
    const points = greatCircleInterpolate(p, p, 10)
    expect(points[0]).toEqual(p)
    expect(points[points.length - 1]).toEqual(p)
  })
})

describe('pathDistanceMeters', () => {
  it('sums consecutive haversine legs', () => {
    const a = { lat: 45.4642, lon: 9.19 }
    const b = { lat: 45.8081, lon: 9.0852 }
    const c = { lat: 46.0, lon: 9.0 }
    expect(pathDistanceMeters([a, b, c])).toBeCloseTo(haversineMeters(a, b) + haversineMeters(b, c), 3)
  })

  it('is zero for a single point or empty path', () => {
    expect(pathDistanceMeters([{ lat: 0, lon: 0 }])).toBe(0)
    expect(pathDistanceMeters([])).toBe(0)
  })
})
