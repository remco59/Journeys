import { describe, it, expect } from 'vitest'
import { reconstructTravelTrace, type GapPoint } from '../../server/domain/traces/reconstruct'

const MIN = 60 * 1000
const HOUR = 60 * MIN

const MILAN = { lat: 45.4642, lon: 9.19 }
const COMO = { lat: 45.8081, lon: 9.0852 }

describe('reconstructTravelTrace', () => {
  it('produces a dense "reconstructed" route when gap photos are frequent enough', () => {
    const from = { ...MILAN, departureAt: 0 }
    const to = { ...COMO, arrivalAt: 40 * MIN }
    const gapPoints: GapPoint[] = [
      { lat: 45.55, lon: 9.15, timestamp: 10 * MIN },
      { lat: 45.65, lon: 9.13, timestamp: 20 * MIN },
      { lat: 45.72, lon: 9.1, timestamp: 30 * MIN }
    ]

    const trace = reconstructTravelTrace(from, to, gapPoints)

    expect(trace.type).toBe('travel')
    expect(trace.confidence).toBe('medium')
    expect(trace.geom).toHaveLength(5) // from + 3 gap points + to
    expect(trace.geom[0]).toEqual(MILAN)
    expect(trace.geom[trace.geom.length - 1]).toEqual(COMO)
    expect(trace.durationS).toBe(40 * 60)
  })

  it('falls back to an unknown/inferred curve when there is no corroborating data', () => {
    const from = { ...MILAN, departureAt: 0 }
    const to = { lat: 52.3105, lon: 4.7683, arrivalAt: 2 * HOUR } // Amsterdam — a flight-length gap
    const trace = reconstructTravelTrace(from, to, [])

    expect(trace.type).toBe('unknown')
    expect(trace.confidence).toBe('inferred')
    expect(trace.geom.length).toBeGreaterThan(2) // sampled curve, not a straight 2-point line
    // Endpoints are exact; the curve should visibly deviate from the
    // straight line at its midpoint so it doesn't look like a real route.
    expect(trace.geom[0]).toEqual(MILAN)
    expect(trace.geom[trace.geom.length - 1]!.lat).toBeCloseTo(52.3105, 6)
    const mid = trace.geom[Math.floor(trace.geom.length / 2)]!
    const straightMidLat = (MILAN.lat + 52.3105) / 2
    const straightMidLon = (MILAN.lon + 4.7683) / 2
    const deviates = Math.abs(mid.lat - straightMidLat) > 1e-6 || Math.abs(mid.lon - straightMidLon) > 1e-6
    expect(deviates).toBe(true)
  })

  it('falls back to unknown when gap points are too sparse relative to the gap duration', () => {
    const from = { ...MILAN, departureAt: 0 }
    const to = { ...COMO, arrivalAt: 5 * HOUR }
    // Only one point across a 5 hour gap — far below one point per ~10 min.
    const trace = reconstructTravelTrace(from, to, [{ lat: 45.6, lon: 9.13, timestamp: 2 * HOUR }])
    expect(trace.type).toBe('unknown')
  })

  it('computes straight-line distance for the unknown branch and path distance for the travel branch', () => {
    const from = { ...MILAN, departureAt: 0 }
    const to = { ...COMO, arrivalAt: 1 * HOUR }
    const denseTrace = reconstructTravelTrace(from, to, [
      { lat: 45.6, lon: 9.15, timestamp: 20 * MIN },
      { lat: 45.7, lon: 9.12, timestamp: 40 * MIN }
    ])
    const sparseTrace = reconstructTravelTrace(from, to, [])

    expect(denseTrace.distanceM).toBeGreaterThan(0)
    expect(sparseTrace.distanceM).toBeGreaterThan(0)
  })
})
