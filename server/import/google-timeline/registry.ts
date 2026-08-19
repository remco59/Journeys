import { GoogleTimelineLegacyParser } from './legacy-parser'
import { GoogleTimelineRecordsParser } from './records-parser'
import { GoogleTimelineSemanticSegmentsParser } from './semantic-segments-parser'
import type { GoogleTimelineParser } from './types'

const parsers: GoogleTimelineParser[] = [
  new GoogleTimelineLegacyParser(),
  new GoogleTimelineRecordsParser(),
  new GoogleTimelineSemanticSegmentsParser()
]

/**
 * Shape-sniffs the parsed JSON against each known export format in turn.
 * Supporting a future Google format is one new parser class + one line
 * here — everything downstream (normalization, observations, clustering)
 * is untouched. See architecture plan §07.
 */
export function detectGoogleTimelineParser(doc: unknown): GoogleTimelineParser | null {
  return parsers.find((p) => p.canParse(doc)) ?? null
}
