import { describe, it, expect } from 'vitest'
import { inferTransportFromSpeed } from '../../server/domain/traces/transport-inference'

const KMH = (kmh: number, hours: number) => ({ distanceM: kmh * hours * 1000, durationS: hours * 3600 })

describe('inferTransportFromSpeed', () => {
  it('matches the brief\'s own worked examples', () => {
    // "3 km in 45 minutes -> likely walking"
    expect(inferTransportFromSpeed(3000, 45 * 60).mode).toBe('walking')
    // "40 km in 90 minutes -> possibly car/train"
    expect(inferTransportFromSpeed(40_000, 90 * 60).mode).toBe('car')
    // "900 km in 2 hours -> likely flight"
    expect(inferTransportFromSpeed(900_000, 2 * 3600).mode).toBe('flight')
  })

  it('classifies walking: under 7 km/h and under 15 km total', () => {
    const { distanceM, durationS } = KMH(5, 1)
    const { mode, confidence } = inferTransportFromSpeed(distanceM, durationS)
    expect(mode).toBe('walking')
    expect(confidence).toBe('medium')
  })

  it('does not call a fast-but-short trip walking once distance exceeds 15 km', () => {
    // 5 km/h average but 20 km total (e.g. many short stops) shouldn't be "walking"
    const { distanceM, durationS } = KMH(5, 4)
    expect(inferTransportFromSpeed(distanceM, durationS).mode).not.toBe('walking')
  })

  it('classifies cycling in the 7-25 km/h band with only low confidence', () => {
    const { distanceM, durationS } = KMH(15, 1)
    const result = inferTransportFromSpeed(distanceM, durationS)
    expect(result.mode).toBe('cycling')
    expect(result.confidence).toBe('low')
  })

  it('never claims car/train certainty from speed alone — always low confidence', () => {
    const { distanceM, durationS } = KMH(80, 1)
    const result = inferTransportFromSpeed(distanceM, durationS)
    expect(result.mode).toBe('car')
    expect(result.confidence).toBe('low')
    expect(result.reason).toMatch(/without corroborating data/)
  })

  it('classifies flight for very high speed even over a short distance', () => {
    const { distanceM, durationS } = KMH(500, 1)
    expect(inferTransportFromSpeed(distanceM, durationS).mode).toBe('flight')
  })

  it('classifies flight for very long distance covered quickly, even if average speed alone is ambiguous', () => {
    // 450km in 2.5h = 180km/h, inside the "car/train" band by speed alone,
    // but the brief's own distance+time shortcut should still catch this.
    expect(inferTransportFromSpeed(450_000, 2.5 * 3600).mode).toBe('flight')
  })

  it('returns unknown, not a guess, for zero distance or duration', () => {
    expect(inferTransportFromSpeed(0, 3600).mode).toBe('unknown')
    expect(inferTransportFromSpeed(5000, 0).mode).toBe('unknown')
  })

  it('every result includes a human-readable reason, never presented as bare certainty', () => {
    const result = inferTransportFromSpeed(40_000, 90 * 60)
    expect(result.reason.length).toBeGreaterThan(10)
  })
})
