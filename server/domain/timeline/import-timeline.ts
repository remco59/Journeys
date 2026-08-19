import { useDb } from '../../db/client'
import { observations } from '../../db/schema'
import { detectGoogleTimelineParser } from '../../import/google-timeline/registry'

export type TimelineImportResult = {
  parserName: string
  pointsImported: number
  visitsImported: number
  movementsImported: number
  totalObservations: number
}

/**
 * Normalizes a parsed Google Timeline export into the append-only
 * observations table (§06). Visits and movements are stored as their
 * constituent points, with source-specific hints (place name, transport
 * mode) carried in raw_data — the clustering/reconstruction stages that
 * consume observations never need to know which source produced them.
 */
export async function importGoogleTimeline(journeyId: string, importId: string, doc: unknown): Promise<TimelineImportResult> {
  const parser = detectGoogleTimelineParser(doc)
  if (!parser) {
    throw new Error('Unrecognized Google Timeline export format')
  }

  const normalized = parser.parse(doc)
  const db = useDb()
  const rows: (typeof observations.$inferInsert)[] = []

  for (const point of normalized.points) {
    rows.push({
      journeyId,
      importId,
      sourceType: 'timeline_point',
      capturedAt: point.timestamp,
      geom: { lat: point.lat, lon: point.lon },
      accuracyM: point.accuracyM,
      confidence: point.confidence,
      rawData: {}
    })
  }

  for (const visit of normalized.visits) {
    rows.push({
      journeyId,
      importId,
      sourceType: 'timeline_visit',
      capturedAt: visit.arrival,
      geom: visit.centroid,
      confidence: visit.confidence,
      rawData: { departure: visit.departure.toISOString(), placeNameHint: visit.placeNameHint }
    })
  }

  for (const movement of normalized.movements) {
    // Every path point (or just the two endpoints, if that's all we have)
    // becomes its own observation, individually queryable by time range —
    // this is what lets trace reconstruction treat Timeline points exactly
    // like photo points when filling a gap between sections.
    const points =
      movement.path.length > 0
        ? movement.path
        : [
            { lat: movement.startPoint.lat, lon: movement.startPoint.lon, timestamp: movement.startPoint.timestamp },
            { lat: movement.endPoint.lat, lon: movement.endPoint.lon, timestamp: movement.endPoint.timestamp }
          ]

    for (const point of points) {
      rows.push({
        journeyId,
        importId,
        sourceType: 'timeline_movement',
        capturedAt: point.timestamp,
        geom: { lat: point.lat, lon: point.lon },
        confidence: movement.confidence,
        rawData: { transportModeHint: movement.transportModeHint }
      })
    }
  }

  if (rows.length > 0) {
    await db.insert(observations).values(rows)
  }

  return {
    parserName: parser.name,
    pointsImported: normalized.points.length,
    visitsImported: normalized.visits.length,
    movementsImported: normalized.movements.length,
    totalObservations: rows.length
  }
}
