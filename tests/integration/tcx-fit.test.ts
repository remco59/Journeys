import { describe, it, expect, beforeAll } from 'vitest'
import { ADMIN_USERNAME, ADMIN_PASSWORD, requireStackReachable, loginCookie, createJourney, uploadActivity, listActivities, makeTcx, makeFit } from './helpers'

beforeAll(requireStackReachable, 15_000)

describe('TCX import (live stack)', () => {
  it('parses a TCX track and maps its Sport attribute correctly', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const tcx = makeTcx(
      [
        { lat: 45.4642, lon: 9.19, ele: 120, time: '2026-08-19T07:00:00Z', heartRate: 130 },
        { lat: 45.47, lon: 9.2, ele: 130, time: '2026-08-19T07:30:00Z', heartRate: 140 }
      ],
      'Running'
    )

    const upload = await uploadActivity(cookie, journey.id, tcx, 'run.tcx')
    expect(upload.status).toBe(201)
    expect(upload.body.files[0].status).toBe('created')

    const activities = await listActivities(cookie, journey.id)
    expect(activities).toHaveLength(1)
    expect(activities[0].type).toBe('running')
    expect(activities[0].distanceM).toBeGreaterThan(0)
  })

  it('reports "other" for TCX\'s Biking-adjacent-but-different sport values honestly', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const tcx = makeTcx(
      [
        { lat: 45, lon: 9, time: '2026-08-19T07:00:00Z' },
        { lat: 45.01, lon: 9.01, time: '2026-08-19T07:10:00Z' }
      ],
      'Other'
    )
    await uploadActivity(cookie, journey.id, tcx, 'other.tcx')
    const activities = await listActivities(cookie, journey.id)
    expect(activities[0].type).toBe('other')
  })

  it('rejects malformed XML instead of crashing', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadActivity(cookie, journey.id, Buffer.from('<not><valid'), 'broken.tcx')
    expect(upload.body.files[0].status).toBe('rejected')
  })
})

describe('FIT import (live stack)', () => {
  it('parses a FIT track, converting semicircle coordinates and trusting the profile sport enum', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const fit = makeFit(
      [
        { lat: 46.4676, lon: 10.3702, ele: 1200, time: '2026-08-19T08:00:00Z', heartRate: 140 },
        { lat: 46.5, lon: 10.42, ele: 1600, time: '2026-08-19T08:20:00Z', heartRate: 155 },
        { lat: 46.5253, lon: 10.4525, ele: 2757, time: '2026-08-19T08:40:00Z', heartRate: 160 }
      ],
      'cycling'
    )

    const upload = await uploadActivity(cookie, journey.id, fit, 'ride.fit')
    expect(upload.status).toBe(201)
    expect(upload.body.files[0].status).toBe('created')

    const activities = await listActivities(cookie, journey.id)
    expect(activities).toHaveLength(1)
    const activity = activities[0]
    expect(activity.type).toBe('cycling')
    expect(activity.distanceM).toBeGreaterThan(0)
    expect(activity.elevationGainM).toBeCloseTo(1557, 0)
    // Semicircle -> degrees conversion should land within a hair of the source coordinate.
    const firstCoord = activity.geom.coordinates[0]
    expect(firstCoord[1]).toBeCloseTo(46.4676, 3)
    expect(firstCoord[0]).toBeCloseTo(10.3702, 3)
  })

  it('rejects a file that is not actually a FIT file', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadActivity(cookie, journey.id, Buffer.from('definitely not a fit file'), 'fake.fit')
    expect(upload.body.files[0].status).toBe('rejected')
  })
})
