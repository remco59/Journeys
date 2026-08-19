import { describe, it, expect } from 'vitest'
import { computeActivityStats } from '../../server/domain/activities/stats'
import type { NormalizedActivityPoint } from '../../server/import/types'

function pt(lat: number, lon: number, ele: number | null, time: string | null): NormalizedActivityPoint {
  return { lat, lon, elevationM: ele, time: time ? new Date(time) : null, heartRate: null, cadence: null, power: null }
}

describe('computeActivityStats', () => {
  it('returns null for a track with no timestamps at all', () => {
    const points = [pt(45, 9, 100, null), pt(45.01, 9.01, 110, null)]
    expect(computeActivityStats(points)).toBeNull()
  })

  it('computes distance, duration, and speed for a simple two-point track', () => {
    const points = [pt(45.4642, 9.19, 200, '2026-08-17T09:00:00Z'), pt(45.4652, 9.191, 200, '2026-08-17T09:10:00Z')]

    const stats = computeActivityStats(points)!
    expect(stats.distanceM).toBeGreaterThan(0)
    expect(stats.startedAt.toISOString()).toBe('2026-08-17T09:00:00.000Z')
    expect(stats.endedAt.toISOString()).toBe('2026-08-17T09:10:00.000Z')
    expect(stats.avgSpeedMps).toBeCloseTo(stats.distanceM / 600, 5)
  })

  it('sums elevation gain and loss separately, ignoring GPS noise below the threshold', () => {
    const points = [
      pt(45, 9, 1000, '2026-08-17T09:00:00Z'),
      pt(45.001, 9, 1000.5, '2026-08-17T09:01:00Z'), // +0.5m — noise, ignored
      pt(45.002, 9, 1010, '2026-08-17T09:02:00Z'), // real climb
      pt(45.003, 9, 995, '2026-08-17T09:03:00Z') // real descent
    ]
    // Deltas accumulate pairwise (1000→1000.5 ignored as noise,
    // 1000.5→1010 counted as +9.5, 1010→995 counted as -15).
    const stats = computeActivityStats(points)!
    expect(stats.elevationGainM).toBeCloseTo(9.5, 5)
    expect(stats.elevationLossM).toBeCloseTo(15, 5)
  })

  it('reports null elevation figures when no point has elevation data', () => {
    const points = [pt(45, 9, null, '2026-08-17T09:00:00Z'), pt(45.01, 9, null, '2026-08-17T09:05:00Z')]
    const stats = computeActivityStats(points)!
    expect(stats.elevationGainM).toBeNull()
    expect(stats.elevationLossM).toBeNull()
  })
})
