import type { ActivityType } from '../types'

const KNOWN: Record<string, ActivityType> = {
  cycling: 'cycling',
  biking: 'cycling',
  bike: 'cycling',
  bicycle: 'cycling',
  running: 'running',
  run: 'running',
  hiking: 'hiking',
  hike: 'hiking',
  walking: 'walking',
  walk: 'walking',
  swimming: 'swimming',
  swim: 'swimming'
}

/**
 * GPX's <type> field is free text with no real standard (Garmin sometimes
 * uses numeric codes with device-specific meaning). We only trust
 * unambiguous plain-text matches — anything else honestly reports
 * "other" rather than guessing at a vendor-specific code.
 */
export function mapGpxActivityType(raw: string | undefined | null): ActivityType {
  if (!raw) return 'other'
  return KNOWN[raw.trim().toLowerCase()] ?? 'other'
}
