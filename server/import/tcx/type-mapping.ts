import type { ActivityType } from '../types'

/**
 * TCX's schema officially only defines three Sport values: Running, Biking,
 * Other — there is no dedicated value for hiking/walking/swimming, so
 * exporters use "Other" for those. We report exactly what the schema
 * actually distinguishes rather than guessing beyond it.
 */
export function mapTcxSport(raw: string | undefined | null): ActivityType {
  const normalized = raw?.trim().toLowerCase()
  if (normalized === 'running') return 'running'
  if (normalized === 'biking' || normalized === 'cycling') return 'cycling'
  return 'other'
}
