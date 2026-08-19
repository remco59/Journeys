import type { ActivityType } from '../types'

// FIT's `sport` field is a standardized profile enum (unlike GPX's free-text
// <type>), so — unusually for this importer layer — it can be trusted directly.
const KNOWN: Record<string, ActivityType> = {
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  walking: 'walking',
  hiking: 'hiking'
}

export function mapFitSport(raw: string | undefined | null): ActivityType {
  if (!raw) return 'other'
  return KNOWN[raw.trim().toLowerCase()] ?? 'other'
}
