import { describe, it, expect } from 'vitest'
import { detectGoogleTimelineParser } from '../../server/import/google-timeline/registry'
import { GoogleTimelineLegacyParser } from '../../server/import/google-timeline/legacy-parser'
import { GoogleTimelineRecordsParser } from '../../server/import/google-timeline/records-parser'
import { GoogleTimelineSemanticSegmentsParser } from '../../server/import/google-timeline/semantic-segments-parser'

describe('detectGoogleTimelineParser', () => {
  it('picks the legacy parser for a timelineObjects export', () => {
    expect(detectGoogleTimelineParser({ timelineObjects: [] })).toBeInstanceOf(GoogleTimelineLegacyParser)
  })
  it('picks the records parser for a raw locations export', () => {
    expect(detectGoogleTimelineParser({ locations: [] })).toBeInstanceOf(GoogleTimelineRecordsParser)
  })
  it('picks the semantic-segments parser for the current export shape', () => {
    expect(detectGoogleTimelineParser({ semanticSegments: [] })).toBeInstanceOf(GoogleTimelineSemanticSegmentsParser)
  })
  it('returns null for an unrecognized shape rather than guessing', () => {
    expect(detectGoogleTimelineParser({ someOtherField: [] })).toBeNull()
    expect(detectGoogleTimelineParser(null)).toBeNull()
    expect(detectGoogleTimelineParser('not even an object')).toBeNull()
  })
})

describe('GoogleTimelineLegacyParser', () => {
  const parser = new GoogleTimelineLegacyParser()

  it('normalizes a placeVisit into a visit', () => {
    const doc = {
      timelineObjects: [
        {
          placeVisit: {
            location: { latitudeE7: 454642000, longitudeE7: 91900000, name: 'Duomo di Milano' },
            duration: { startTimestamp: '2026-08-17T09:00:00.000Z', endTimestamp: '2026-08-17T10:30:00.000Z' }
          }
        }
      ]
    }
    const result = parser.parse(doc)
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]!.centroid).toEqual({ lat: 45.4642, lon: 9.19 })
    expect(result.visits[0]!.placeNameHint).toBe('Duomo di Milano')
  })

  it('normalizes an activitySegment with a simplifiedRawPath into a high-confidence movement', () => {
    const doc = {
      timelineObjects: [
        {
          activitySegment: {
            startLocation: { latitudeE7: 454642000, longitudeE7: 91900000 },
            endLocation: { latitudeE7: 458081000, longitudeE7: 90852000 },
            duration: { startTimestampMs: '1755421200000', endTimestampMs: '1755424800000' },
            activityType: 'IN_TRAIN',
            simplifiedRawPath: {
              points: [
                { latE7: 455000000, lngE7: 91500000, timestampMs: '1755422000000' },
                { latE7: 457000000, lngE7: 91000000, timestampMs: '1755423000000' }
              ]
            }
          }
        }
      ]
    }
    const result = parser.parse(doc)
    expect(result.movements).toHaveLength(1)
    const movement = result.movements[0]!
    expect(movement.confidence).toBe('high')
    expect(movement.transportModeHint).toBe('IN_TRAIN')
    expect(movement.path).toHaveLength(2)
    expect(movement.path[0]!.lat).toBeCloseTo(45.5, 5)
  })

  it('interpolates timestamps for a waypointPath (no per-point time in that shape)', () => {
    const doc = {
      timelineObjects: [
        {
          activitySegment: {
            startLocation: { latitudeE7: 454642000, longitudeE7: 91900000 },
            endLocation: { latitudeE7: 458081000, longitudeE7: 90852000 },
            duration: { startTimestamp: '2026-08-17T09:00:00.000Z', endTimestamp: '2026-08-17T09:20:00.000Z' },
            waypointPath: { waypoints: [{ latE7: 455000000, lngE7: 91500000 }] }
          }
        }
      ]
    }
    const result = parser.parse(doc)
    const movement = result.movements[0]!
    expect(movement.confidence).toBe('medium') // no real per-point timestamps
    expect(movement.path).toHaveLength(1)
    expect(movement.path[0]!.timestamp.toISOString()).toBe('2026-08-17T09:00:00.000Z')
  })

  it('ignores an entry missing required fields rather than throwing', () => {
    const doc = { timelineObjects: [{ placeVisit: { location: {} } }] }
    expect(() => parser.parse(doc)).not.toThrow()
    expect(parser.parse(doc).visits).toHaveLength(0)
  })
})

describe('GoogleTimelineRecordsParser', () => {
  const parser = new GoogleTimelineRecordsParser()

  it('normalizes raw location pings into points, confidence keyed off accuracy', () => {
    const doc = {
      locations: [
        { latitudeE7: 454642000, longitudeE7: 91900000, timestampMs: '1755421200000', accuracy: 12 },
        { latitudeE7: 454700000, longitudeE7: 91950000, timestamp: '2026-08-17T09:05:00.000Z', accuracy: 200 }
      ]
    }
    const result = parser.parse(doc)
    expect(result.points).toHaveLength(2)
    expect(result.points[0]!.confidence).toBe('high')
    expect(result.points[1]!.confidence).toBe('medium')
  })
})

describe('GoogleTimelineSemanticSegmentsParser', () => {
  const parser = new GoogleTimelineSemanticSegmentsParser()

  it('normalizes a visit segment using the degree-string latLng format', () => {
    const doc = {
      semanticSegments: [
        {
          startTime: '2026-08-17T09:00:00.000Z',
          endTime: '2026-08-17T10:00:00.000Z',
          visit: { topCandidate: { placeLocation: { latLng: '45.4642°, 9.1900°' } } }
        }
      ]
    }
    const result = parser.parse(doc)
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]!.centroid.lat).toBeCloseTo(45.4642, 4)
  })

  it('normalizes an activity segment with its topCandidate type as the transport hint', () => {
    const doc = {
      semanticSegments: [
        {
          startTime: '2026-08-17T09:00:00.000Z',
          endTime: '2026-08-17T09:20:00.000Z',
          activity: {
            start: { latLng: '45.4642°, 9.1900°' },
            end: { latLng: '45.8081°, 9.0852°' },
            topCandidate: { type: 'walking' }
          }
        }
      ]
    }
    const result = parser.parse(doc)
    expect(result.movements).toHaveLength(1)
    expect(result.movements[0]!.transportModeHint).toBe('walking')
  })

  it('extracts dense, high-confidence points from timelinePath', () => {
    const doc = {
      semanticSegments: [
        {
          startTime: '2026-08-17T09:00:00.000Z',
          endTime: '2026-08-17T09:10:00.000Z',
          timelinePath: [
            { point: '45.4642°, 9.1900°', time: '2026-08-17T09:00:00.000Z' },
            { point: '45.4700°, 9.1950°', time: '2026-08-17T09:05:00.000Z' }
          ]
        }
      ]
    }
    const result = parser.parse(doc)
    expect(result.points).toHaveLength(2)
    expect(result.points.every((p) => p.confidence === 'high')).toBe(true)
  })
})
