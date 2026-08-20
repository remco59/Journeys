import type { traces } from '../../db/schema'

type TransportMode = (typeof traces.$inferInsert)['transportMode']
type Confidence = (typeof traces.$inferInsert)['confidence']

export type InferredTransport = { mode: TransportMode; confidence: Confidence; reason: string }

/**
 * Rule-based first pass over speed and distance (§11) — used only when no
 * corroborating source (Timeline hint, activity file) already resolved the
 * mode. Every result carries a plain-language reason and a confidence that
 * is never higher than the evidence actually supports: a bare speed number
 * can't distinguish car from train, so that band deliberately stays "low".
 */
export function inferTransportFromSpeed(distanceM: number, durationS: number): InferredTransport {
  if (durationS <= 0 || distanceM <= 0) {
    return { mode: 'unsure', confidence: 'inferred', reason: 'Not enough distance or elapsed time to estimate a speed' }
  }

  const distanceKm = distanceM / 1000
  const durationH = durationS / 3600
  const speedKmh = distanceKm / durationH

  if (speedKmh > 300 || (distanceKm > 400 && durationH < 3)) {
    return {
      mode: 'flight',
      confidence: 'medium',
      reason: `${Math.round(distanceKm)} km in ${durationH.toFixed(1)}h is far beyond any ground transport speed`
    }
  }
  if (speedKmh < 7 && distanceKm < 15) {
    return { mode: 'walking', confidence: 'medium', reason: `${speedKmh.toFixed(1)} km/h over ${distanceKm.toFixed(1)} km is walking pace` }
  }
  if (speedKmh >= 7 && speedKmh < 25) {
    return { mode: 'cycling', confidence: 'low', reason: `${speedKmh.toFixed(1)} km/h is consistent with cycling, but could also be slow traffic` }
  }
  if (speedKmh >= 25 && speedKmh <= 160) {
    return {
      mode: 'car',
      confidence: 'low',
      reason: `${speedKmh.toFixed(1)} km/h is consistent with a car or train — defaulting to car without corroborating data`
    }
  }

  return {
    mode: 'unsure',
    confidence: 'inferred',
    reason: `${speedKmh.toFixed(1)} km/h over ${distanceKm.toFixed(1)} km doesn't clearly match a known transport pattern`
  }
}
