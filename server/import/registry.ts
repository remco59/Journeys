import type { ActivityImporter } from './types'
import { GpxImporter } from './gpx/parser'
import { TcxImporter } from './tcx/parser'
import { FitImporter } from './fit/parser'

const importers: Record<string, ActivityImporter> = {
  gpx: new GpxImporter(),
  tcx: new TcxImporter(),
  fit: new FitImporter()
}

/** Registry pattern (§07): adding a new format is a new module + one line here — nothing downstream changes. */
export function getActivityImporter(extension: string): ActivityImporter | null {
  const key = extension.replace(/^\./, '').toLowerCase()
  return importers[key] ?? null
}
