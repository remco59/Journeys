export type TimelineConfidence = 'high' | 'medium' | 'low' | 'inferred'

export type NormalizedTimelinePoint = {
  timestamp: Date
  lat: number
  lon: number
  accuracyM: number | null
  confidence: TimelineConfidence
}

export type NormalizedTimelineVisit = {
  centroid: { lat: number; lon: number }
  arrival: Date
  departure: Date
  /** Google's own place guess — a hint for future naming assistance, never authoritative. */
  placeNameHint: string | null
  confidence: TimelineConfidence
}

export type NormalizedTimelineMovement = {
  startPoint: { lat: number; lon: number; timestamp: Date }
  endPoint: { lat: number; lon: number; timestamp: Date }
  /** Real intermediate points when the export includes them — empty when it only has endpoints. */
  path: Array<{ lat: number; lon: number; timestamp: Date }>
  transportModeHint: string | null
  confidence: TimelineConfidence
}

export type NormalizedTimelineData = {
  points: NormalizedTimelinePoint[]
  visits: NormalizedTimelineVisit[]
  movements: NormalizedTimelineMovement[]
}

/**
 * One parser per Google Timeline export shape (§07). Google has changed
 * this format more than once; adding support for a future shape is a new
 * module + one registry line, nothing else changes.
 */
export interface GoogleTimelineParser {
  name: string
  canParse(doc: unknown): boolean
  parse(doc: unknown): NormalizedTimelineData
}
