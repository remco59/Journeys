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
  waitForAllProcessed,
  clusterNow,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

async function listTraces(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/traces`, { headers: { cookie } })
  return res.json()
}

describe('transport mode inference and manual override (live stack)', () => {
  it('infers "walking" from a slow, dense gap with no Timeline/activity data, and records a plain-language reason', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // ~2.2 km covered over 30 minutes ≈ 4.4 km/h — walking pace — with
    // photos dense enough (every 8 min) to count as a reconstructed route.
    const a = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    const mid1 = await makeJpegAt(45.474, 9.19, '2026:08:19 09:08:00')
    const mid2 = await makeJpegAt(45.484, 9.19, '2026:08:19 09:16:00')
    const b = await makeJpegAt(45.4938, 9.19, '2026:08:19 09:30:00')

    await uploadPhoto(cookie, journey.id, a, 'a.jpg')
    await uploadPhoto(cookie, journey.id, mid1, 'mid1.jpg')
    await uploadPhoto(cookie, journey.id, mid2, 'mid2.jpg')
    await uploadPhoto(cookie, journey.id, b, 'b.jpg')
    await waitForAllProcessed(cookie, journey.id, 4)
    await clusterNow(cookie, journey.id)

    // Free the two middle photos from whatever section clustering put them
    // in, so they count as gap evidence rather than forming their own stop
    // (mirrors the Phase 6 test's approach — see traces.test.ts).
    const photosRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/photos`, { headers: { cookie } })
    const photos = await photosRes.json()
    // Identify the two middle photos by capture time (upload order isn't guaranteed).
    const sortedByTime = [...photos].sort((a: any, b: any) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    const middleTwo = sortedByTime.slice(1, 3)
    for (const p of middleTwo) {
      await fetch(`${BASE_URL}/api/photos/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ sectionId: null })
      })
    }
    await clusterNow(cookie, journey.id)

    const traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)
    expect(traces[0].type).toBe('travel')
    expect(traces[0].transportMode).toBe('walking')
    expect(traces[0].transportModeReason).toMatch(/walking pace/)
  }, 40_000)

  it('lets a user manually override a trace\'s transport mode, and locks it against reclustering', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const a = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    const b = await makeJpegAt(45.8081, 9.0852, '2026:08:19 13:00:00')
    await uploadPhoto(cookie, journey.id, a, 'a.jpg')
    await uploadPhoto(cookie, journey.id, b, 'b.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)
    await clusterNow(cookie, journey.id)

    const traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)
    const traceId = traces[0].id

    const patchRes = await fetch(`${BASE_URL}/api/traces/${traceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ transportMode: 'train' })
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json()
    expect(updated.transportMode).toBe('train')
    expect(updated.source).toBe('user_override')
    expect(updated.lockedFields).toContain('transportMode')

    await clusterNow(cookie, journey.id)
    const tracesAfter = await listTraces(cookie, journey.id)
    expect(tracesAfter).toHaveLength(1)
    expect(tracesAfter[0].transportMode).toBe('train')
    expect(tracesAfter[0].transportModeReason).toBe('Set manually')
  }, 40_000)

  it('never lets another user override a trace on a journey they do not own', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const a = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    const b = await makeJpegAt(45.8081, 9.0852, '2026:08:19 13:00:00')
    await uploadPhoto(cookie, journey.id, a, 'a.jpg')
    await uploadPhoto(cookie, journey.id, b, 'b.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)
    await clusterNow(cookie, journey.id)
    const traces = await listTraces(cookie, journey.id)

    const otherUsername = `trace-other-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const res = await fetch(`${BASE_URL}/api/traces/${traces[0].id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ transportMode: 'flight' })
    })
    expect(res.status).toBe(404)
  }, 40_000)
})
