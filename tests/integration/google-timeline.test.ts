import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  BASE_URL,
  requireStackReachable,
  loginCookie,
  createUser,
  createJourney,
  uploadPhoto,
  uploadTimeline,
  waitForAllProcessed,
  clusterNow,
  listSections,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

async function listTraces(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/traces`, { headers: { cookie } })
  return res.json()
}

describe('Google Timeline import (live stack)', () => {
  it('imports the legacy timelineObjects format', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const doc = {
      timelineObjects: [
        {
          placeVisit: {
            location: { latitudeE7: 454642000, longitudeE7: 91900000, name: 'Duomo di Milano' },
            duration: { startTimestamp: '2026-08-17T09:00:00.000Z', endTimestamp: '2026-08-17T10:00:00.000Z' }
          }
        },
        {
          activitySegment: {
            startLocation: { latitudeE7: 454642000, longitudeE7: 91900000 },
            endLocation: { latitudeE7: 458081000, longitudeE7: 90852000 },
            duration: { startTimestamp: '2026-08-17T10:00:00.000Z', endTimestamp: '2026-08-17T10:30:00.000Z' },
            activityType: 'WALKING'
          }
        }
      ]
    }

    const upload = await uploadTimeline(cookie, journey.id, doc)
    expect(upload.status).toBe(201)
    expect(upload.body.parserName).toBe('google-timeline-legacy')
    expect(upload.body.visitsImported).toBe(1)
    expect(upload.body.movementsImported).toBe(1)
  })

  it('imports the raw records.json format', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const doc = {
      locations: [
        { latitudeE7: 454642000, longitudeE7: 91900000, timestampMs: '1755421200000', accuracy: 10 },
        { latitudeE7: 454700000, longitudeE7: 91950000, timestampMs: '1755421500000', accuracy: 15 }
      ]
    }
    const upload = await uploadTimeline(cookie, journey.id, doc)
    expect(upload.status).toBe(201)
    expect(upload.body.parserName).toBe('google-timeline-records')
    expect(upload.body.pointsImported).toBe(2)
  })

  it('imports the current semanticSegments format, including dense timelinePath points', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
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
    const upload = await uploadTimeline(cookie, journey.id, doc)
    expect(upload.status).toBe(201)
    expect(upload.body.parserName).toBe('google-timeline-semantic-segments')
    expect(upload.body.pointsImported).toBe(2)
  })

  it('rejects an unrecognized export shape with a clear reason instead of crashing', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadTimeline(cookie, journey.id, { somethingElseEntirely: true })
    expect(upload.status).toBe(400)
  })

  it('rejects a file that is not valid JSON', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const form = new FormData()
    form.append('file', new Blob(['not json'], { type: 'application/json' }), 'bad.json')
    const res = await fetch(`${BASE_URL}/api/journeys/${journey.id}/timeline`, { method: 'POST', headers: { cookie }, body: form })
    expect(res.status).toBe(400)
  })

  it('dedupes an identical re-upload', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const doc = { locations: [{ latitudeE7: 454642000, longitudeE7: 91900000, timestampMs: '1755421200000' }] }
    const first = await uploadTimeline(cookie, journey.id, doc)
    expect(first.body.status).toBe('completed')
    const second = await uploadTimeline(cookie, journey.id, doc)
    expect(second.body.status).toBe('duplicate')
  })

  it('never lets another user import Timeline data into a journey they do not own', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const otherUsername = `timeline-other-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const upload = await uploadTimeline(otherCookie, journey.id, { locations: [] })
    expect(upload.status).toBe(404)
  })

  it('upgrades an otherwise-"unknown" gap to a high-confidence travel trace with a transport mode, using dense Timeline movement points', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // Amsterdam and Milan, four hours apart — exactly the brief's own
    // "no Timeline data -> unknown" example, except this time we DO
    // supply Timeline data for the gap.
    const amsterdam = await makeJpegAt(52.3676, 4.9041, '2026:08:17 08:00:00')
    const milan = await makeJpegAt(45.4642, 9.19, '2026:08:17 12:00:00')
    await uploadPhoto(cookie, journey.id, amsterdam, 'ams.jpg')
    await uploadPhoto(cookie, journey.id, milan, 'milan.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)
    await clusterNow(cookie, journey.id)

    const sectionsBefore = await listSections(cookie, journey.id)
    expect(sectionsBefore).toHaveLength(2)
    const tracesBefore = await listTraces(cookie, journey.id)
    expect(tracesBefore[0].type).toBe('unknown')

    // Photos resolve to 06:00Z (Amsterdam, UTC+2) and 10:00Z (Milan, UTC+2).
    // Fill that 4-hour gap with a point every 8 minutes — well under the
    // ~10min/point density threshold — tagged as a train.
    const points: Array<Record<string, unknown>> = []
    const start = new Date('2026-08-17T06:05:00.000Z').getTime()
    for (let i = 0; i < 29; i++) {
      const t = start + i * 8 * 60_000
      const frac = i / 28
      points.push({
        latE7: Math.round((52.3676 + (45.4642 - 52.3676) * frac) * 1e7),
        lngE7: Math.round((4.9041 + (9.19 - 4.9041) * frac) * 1e7),
        timestampMs: String(t)
      })
    }
    const doc = {
      timelineObjects: [
        {
          activitySegment: {
            startLocation: { latitudeE7: 523676000, longitudeE7: 49041000 },
            endLocation: { latitudeE7: 454642000, longitudeE7: 91900000 },
            duration: { startTimestampMs: String(start), endTimestampMs: String(start + 28 * 8 * 60_000) },
            activityType: 'IN_TRAIN',
            simplifiedRawPath: { points }
          }
        }
      ]
    }

    const upload = await uploadTimeline(cookie, journey.id, doc)
    expect(upload.status).toBe(201)
    expect(upload.body.movementsImported).toBe(1)

    const sectionsAfter = await listSections(cookie, journey.id)
    expect(sectionsAfter).toHaveLength(2) // Timeline data alone doesn't create new sections

    const tracesAfter = await listTraces(cookie, journey.id)
    expect(tracesAfter).toHaveLength(1)
    expect(tracesAfter[0].type).toBe('travel')
    expect(tracesAfter[0].confidence).toBe('high')
    expect(tracesAfter[0].transportMode).toBe('train')
    expect(tracesAfter[0].geom.coordinates.length).toBeGreaterThan(2)
  }, 40_000)
})
