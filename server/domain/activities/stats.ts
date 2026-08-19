import { haversineMeters } from '../clustering/geo-math'
import type { NormalizedActivityPoint } from '../../import/types'

export type ActivityStats = {
  distanceM: number
  elevationGainM: number | null
  elevationLossM: number | null
  avgSpeedMps: number | null
  startedAt: Date
  endedAt: Date
}

// Ignores elevation deltas below this to avoid GPS altitude noise inflating gain/loss.
const ELEVATION_NOISE_THRESHOLD_M = 1

/** Returns null when the track has no timestamps at all — it can't be placed in the Story without one. */
export function computeActivityStats(points: NormalizedActivityPoint[]): ActivityStats | null {
  const timedPoints = points.filter((p) => p.time)
  if (timedPoints.length === 0) return null

  let distanceM = 0
  let elevationGainM = 0
  let elevationLossM = 0
  let hasElevation = false

  for (let i = 1; i < points.length; i++) {
    distanceM += haversineMeters(points[i - 1]!, points[i]!)
    const prevEle = points[i - 1]!.elevationM
    const ele = points[i]!.elevationM
    if (prevEle != null && ele != null) {
      hasElevation = true
      const delta = ele - prevEle
      if (delta > ELEVATION_NOISE_THRESHOLD_M) elevationGainM += delta
      else if (delta < -ELEVATION_NOISE_THRESHOLD_M) elevationLossM += -delta
    }
  }

  const startedAt = timedPoints[0]!.time!
  const endedAt = timedPoints[timedPoints.length - 1]!.time!
  const durationS = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1000)

  return {
    distanceM,
    elevationGainM: hasElevation ? elevationGainM : null,
    elevationLossM: hasElevation ? elevationLossM : null,
    avgSpeedMps: durationS > 0 ? distanceM / durationS : null,
    startedAt,
    endedAt
  }
}
