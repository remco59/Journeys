import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  BASE_URL,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  requireStackReachable,
  loginCookie,
  createJourney,
  uploadPhoto,
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

describe('trace reconstruction (live stack)', () => {
  it('draws an unknown/inferred curved trace between two sections with no data in the gap', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // Amsterdam, then Milan four hours later — a flight-length gap with
    // nothing in between, matching the brief's own worked example.
    const amsterdam = await makeJpegAt(52.3676, 4.9041, '2026:08:17 08:00:00')
    const milan = await makeJpegAt(45.4642, 9.19, '2026:08:17 12:00:00')
    await uploadPhoto(cookie, journey.id, amsterdam, 'ams.jpg')
    await uploadPhoto(cookie, journey.id, milan, 'milan.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)

    const result = await clusterNow(cookie, journey.id)
    expect(result.sectionsCreated).toBe(2)
    expect(result.tracesCreated).toBe(1)

    const sections = await listSections(cookie, journey.id)
    const traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)

    const trace = traces[0]
    expect(trace.type).toBe('unknown')
    expect(trace.confidence).toBe('inferred')
    expect(trace.fromSectionId).toBe(sections[0].id)
    expect(trace.toSectionId).toBe(sections[1].id)
    expect(trace.geom.type).toBe('LineString')
    expect(trace.geom.coordinates.length).toBeGreaterThan(2)
  }, 40_000)

  it('upgrades to a "reconstructed" travel trace once en-route photos are freed from their own auto-sections', async () => {
    // With photos as the only source (Timeline/GPX arrive in later phases),
    // clustering always assigns every geotagged photo to *some* section —
    // there's no automatic "noise" bucket a photo can land in on its own.
    // So the only way today for a photo to become genuine "gap evidence"
    // for the travel-trace branch is a manual correction: the user decides
    // an en-route snapshot doesn't belong to either place and unassigns it.
    // That's exactly what this test drives, and it's a real, useful path —
    // not a contrived one.
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const milan = await makeJpegAt(45.4642, 9.19, '2026:08:17 09:00:00')
    const enRoute1 = await makeJpegAt(45.55, 9.15, '2026:08:17 09:10:00')
    const enRoute2 = await makeJpegAt(45.65, 9.13, '2026:08:17 09:20:00')
    const como = await makeJpegAt(45.8081, 9.0852, '2026:08:17 09:30:00')

    const uploads = await Promise.all([
      uploadPhoto(cookie, journey.id, milan, 'milan.jpg'),
      uploadPhoto(cookie, journey.id, enRoute1, 'en-route-1.jpg'),
      uploadPhoto(cookie, journey.id, enRoute2, 'en-route-2.jpg'),
      uploadPhoto(cookie, journey.id, como, 'como.jpg')
    ])
    await waitForAllProcessed(cookie, journey.id, 4)
    await clusterNow(cookie, journey.id)

    // Unassign the two en-route photos — this locks sectionId to null, so
    // reclustering won't fold them back into a section of their own.
    for (const upload of [uploads[1], uploads[2]]) {
      await fetch(`${BASE_URL}/api/photos/${upload.body.files[0].photoId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ sectionId: null })
      })
    }

    await clusterNow(cookie, journey.id)

    const sections = await listSections(cookie, journey.id)
    expect(sections).toHaveLength(2) // the two now-empty micro-sections were cleaned up

    const traces = await listTraces(cookie, journey.id)
    const travelTrace = traces.find((t: any) => t.type === 'travel')
    expect(travelTrace).toBeTruthy()
    expect(travelTrace.confidence).toBe('medium')
    expect(travelTrace.geom.coordinates.length).toBeGreaterThanOrEqual(3)
  }, 40_000)

  it('keeps the same trace id stable across repeated reclustering with no new data', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const a = await makeJpegAt(45.4642, 9.19, '2026:08:17 09:00:00')
    const b = await makeJpegAt(45.8081, 9.0852, '2026:08:17 13:00:00')
    await uploadPhoto(cookie, journey.id, a, 'a.jpg')
    await uploadPhoto(cookie, journey.id, b, 'b.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)
    await clusterNow(cookie, journey.id)

    const traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)

    // No manual override endpoint exists yet (that's Phase 11) — this test
    // documents today's behavior: reclustering with no new data leaves the
    // single trace stable rather than duplicating or dropping it.
    await clusterNow(cookie, journey.id)
    const tracesAfter = await listTraces(cookie, journey.id)
    expect(tracesAfter).toHaveLength(1)
    expect(tracesAfter[0].id).toBe(traces[0].id)
  }, 40_000)
})
