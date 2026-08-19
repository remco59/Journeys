import type { ActivityImporter } from './types'
import { GpxImporter } from './gpx/parser'

const importers: Record<string, ActivityImporter> = {
  gpx: new GpxImporter()
}

/** Registry pattern (§07): adding TCX/FIT is a new module + one line here — nothing downstream changes. */
export function getActivityImporter(extension: string): ActivityImporter | null {
  const key = extension.replace(/^\./, '').toLowerCase()
  return importers[key] ?? null
}
