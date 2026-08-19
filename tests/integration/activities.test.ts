import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  BASE_URL,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  requireStackReachable,
  loginCookie,
  createUser,
  createJourney,
  uploadPhoto,
  uploadActivity,
  listActivities,
  listSections,
  waitForAllProcessed,
  clusterNow,
  makeGpx,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

async function listTraces(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/traces`, { headers: { cookie } })
  return res.json()
}

describe('GPX import and activities (live stack)', () => {
  it('parses a GPX track into an activity with computed stats', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const gpx = makeGpx(
      [
        { lat: 46.5253, lon: 10.4525, ele: 1200, time: '2026-08-19T08:00:00Z' },
        { lat: 46.53, lon: 10.46, ele: 1400, time: '2026-08-19T08:20:00Z' },
        { lat: 46.54, lon: 10.47, ele: 1750, time: '2026-08-19T08:40:00Z' }
      ],
      { name: 'Stelvio climb', type: 'cycling' }
    )

    const upload = await uploadActivity(cookie, journey.id, gpx, 'stelvio.gpx')
    expect(upload.status).toBe(201)
    expect(upload.body.files[0].status).toBe('created')

    const activities = await listActivities(cookie, journey.id)
    expect(activities).toHaveLength(1)
    const activity = activities[0]
    expect(activity.title).toBe('Stelvio climb')
    expect(activity.type).toBe('cycling')
    expect(activity.distanceM).toBeGreaterThan(0)
    expect(activity.elevationGainM).toBeCloseTo(550, 0)
    expect(activity.geom.type).toBe('LineString')
    expect(activity.geom.coordinates.length).toBeGreaterThanOrEqual(2)
  })

  it('falls back to "other" for an unrecognized or vendor-specific <type>', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const gpx = makeGpx(
      [
        { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
        { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
      ],
      { type: '9' } // Garmin-style numeric code — deliberately not trusted
    )
    await uploadActivity(cookie, journey.id, gpx, 'unknown-type.gpx')
    const activities = await listActivities(cookie, journey.id)
    expect(activities[0].type).toBe('other')
  })

  it('dedupes an identical GPX re-upload by checksum', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const gpx = makeGpx([
      { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
      { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
    ])

    const first = await uploadActivity(cookie, journey.id, gpx, 'a.gpx')
    expect(first.body.files[0].status).toBe('created')
    const second = await uploadActivity(cookie, journey.id, gpx, 'a-copy.gpx')
    expect(second.body.files[0].status).toBe('duplicate')
  })

  it('rejects a non-GPX file with a clear reason instead of crashing', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadActivity(cookie, journey.id, Buffer.from('not xml at all'), 'fake.gpx')
    expect(upload.body.files[0].status).toBe('rejected')
  })

  it('rejects a GPX track with no timestamps, since it cannot be placed in the Story', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const noTimeGpx = Buffer.from(`<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="45" lon="9"><ele>100</ele></trkpt>
  <trkpt lat="45.01" lon="9.01"><ele>110</ele></trkpt>
</trkseg></trk></gpx>`)
    const upload = await uploadActivity(cookie, journey.id, noTimeGpx, 'no-time.gpx')
    expect(upload.body.files[0].status).toBe('rejected')
  })

  it('never lets another user see activities from a journey they do not own', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    await uploadActivity(
      cookie,
      journey.id,
      makeGpx([
        { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
        { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
      ]),
      'private.gpx'
    )

    const otherUsername = `activity-other-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const res = await fetch(`${BASE_URL}/api/journeys/${journey.id}/activities`, { headers: { cookie: otherCookie } })
    expect(res.status).toBe(404)
  })

  it('edits an activity\'s title and type', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const gpx = makeGpx([
      { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
      { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
    ])
    await uploadActivity(cookie, journey.id, gpx, 'ride.gpx')
    const activityId = (await listActivities(cookie, journey.id))[0].id

    const res = await fetch(`${BASE_URL}/api/activities/${activityId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'Renamed ride', type: 'hiking' })
    })
    expect(res.status).toBe(200)

    const activities = await listActivities(cookie, journey.id)
    expect(activities[0].title).toBe('Renamed ride')
    expect(activities[0].type).toBe('hiking')
  })

  it('deletes an activity', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const gpx = makeGpx([
      { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
      { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
    ])
    await uploadActivity(cookie, journey.id, gpx, 'ride.gpx')
    const activityId = (await listActivities(cookie, journey.id))[0].id

    const res = await fetch(`${BASE_URL}/api/activities/${activityId}`, { method: 'DELETE', headers: { cookie } })
    expect(res.status).toBe(200)

    const activities = await listActivities(cookie, journey.id)
    expect(activities).toHaveLength(0)
  })

  it('never lets another user edit or delete an activity on a journey they do not own', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const gpx = makeGpx([
      { lat: 45, lon: 9, time: '2026-08-19T08:00:00Z' },
      { lat: 45.01, lon: 9.01, time: '2026-08-19T08:10:00Z' }
    ])
    await uploadActivity(cookie, journey.id, gpx, 'ride.gpx')
    const activityId = (await listActivities(cookie, journey.id))[0].id

    const otherUsername = `activity-owner-check-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const patch = await fetch(`${BASE_URL}/api/activities/${activityId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ title: 'hijacked' })
    })
    expect(patch.status).toBe(404)

    const del = await fetch(`${BASE_URL}/api/activities/${activityId}`, { method: 'DELETE', headers: { cookie: otherCookie } })
    expect(del.status).toBe(404)
  })

  it('produces an "activity" trace (pine, high confidence) when a GPX track covers the gap between two sections', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // Bormio/Stelvio are real coordinates in Italy: makeJpegAt's photos carry
    // no GPS-independent timezone, so extractPhotoMetadata correctly resolves
    // their local EXIF time (07:00/09:00) through Europe/Rome (UTC+2 in
    // August) — the true captured_at ends up as 05:00Z/07:00Z, two hours
    // earlier than the naive local string. The GPX times below are set in
    // real UTC to actually fall inside that window.
    const start = await makeJpegAt(46.4676, 10.3702, '2026:08:19 07:00:00')
    const end = await makeJpegAt(46.5253, 10.4525, '2026:08:19 09:00:00')
    await uploadPhoto(cookie, journey.id, start, 'bormio.jpg')
    await uploadPhoto(cookie, journey.id, end, 'stelvio.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)

    const gpx = makeGpx(
      [
        { lat: 46.4676, lon: 10.3702, ele: 1200, time: '2026-08-19T05:05:00Z' },
        { lat: 46.5, lon: 10.42, ele: 1600, time: '2026-08-19T06:00:00Z' },
        { lat: 46.5253, lon: 10.4525, ele: 2757, time: '2026-08-19T06:55:00Z' }
      ],
      { name: 'Bormio to Stelvio', type: 'cycling' }
    )
    await uploadActivity(cookie, journey.id, gpx, 'ride.gpx')

    await clusterNow(cookie, journey.id)

    const sections = await listSections(cookie, journey.id)
    expect(sections).toHaveLength(2)

    const traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)
    expect(traces[0].type).toBe('activity')
    expect(traces[0].transportMode).toBe('cycling')
    expect(traces[0].confidence).toBe('high')
    expect(traces[0].geom.coordinates.length).toBeGreaterThanOrEqual(2)
  }, 40_000)
})
