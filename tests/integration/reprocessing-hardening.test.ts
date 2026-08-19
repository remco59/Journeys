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
  listPhotos,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

async function listTraces(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/traces`, { headers: { cookie } })
  return res.json()
}

describe('reprocessing never clobbers manual edits, even across a real new-data import (live stack)', () => {
  it('preserves a locked section title, a locked photo placement, and a locked trace transport mode all at once, after uploading unrelated new photos', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // Two well-separated stops, two photos each — so a manual photo move
    // between them never empties out either section (a section left with
    // zero members is cleaned up by design; that's a separate, correct
    // behavior this test deliberately avoids triggering).
    const milan1 = await makeJpegAt(45.4642, 9.19, '2026:08:20 09:00:00')
    const milan2 = await makeJpegAt(45.4643, 9.1901, '2026:08:20 09:05:00')
    const como1 = await makeJpegAt(45.8081, 9.0852, '2026:08:20 13:00:00')
    const como2 = await makeJpegAt(45.808, 9.0853, '2026:08:20 13:05:00')
    for (const [i, buf] of [milan1, milan2, como1, como2].entries()) {
      await uploadPhoto(cookie, journey.id, buf, `photo-${i}.jpg`)
    }
    await waitForAllProcessed(cookie, journey.id, 4)
    await clusterNow(cookie, journey.id)

    let sections = await listSections(cookie, journey.id)
    expect(sections).toHaveLength(2)
    const [milanSection, comoSection] = sections

    // Lock 1: rename a section.
    await fetch(`${BASE_URL}/api/sections/${milanSection.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'Milano — my custom name' })
    })

    // Lock 2: manually reassign one Como photo into the Milan section
    // (Como keeps its other photo, so it stays a real, non-empty section).
    const photosBefore = await listPhotos(cookie, journey.id)
    const comoPhotoToMove = photosBefore.find((p: any) => p.sectionId === comoSection.id)
    await fetch(`${BASE_URL}/api/photos/${comoPhotoToMove.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sectionId: milanSection.id })
    })

    // Lock 3: override the trace's transport mode.
    let traces = await listTraces(cookie, journey.id)
    expect(traces).toHaveLength(1)
    const traceId = traces[0].id
    await fetch(`${BASE_URL}/api/traces/${traceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ transportMode: 'flight' })
    })

    // Now bring in genuinely new, unrelated data: a third stop, uploaded
    // like any normal new-photos import — not a bare recluster call.
    const bergamo = await makeJpegAt(45.6983, 9.6773, '2026:08:20 16:00:00')
    await uploadPhoto(cookie, journey.id, bergamo, 'bergamo.jpg')
    await waitForAllProcessed(cookie, journey.id, 5)
    await clusterNow(cookie, journey.id)

    // All three manual decisions must have survived, unchanged.
    sections = await listSections(cookie, journey.id)
    const stillMilan = sections.find((s: any) => s.id === milanSection.id)
    expect(stillMilan.title).toBe('Milano — my custom name')
    expect(stillMilan.lockedFields).toContain('title')

    const stillComo = sections.find((s: any) => s.id === comoSection.id)
    expect(stillComo).toBeTruthy() // never emptied out, so never cleaned up

    const photosAfter = await listPhotos(cookie, journey.id)
    const movedPhoto = photosAfter.find((p: any) => p.id === comoPhotoToMove.id)
    expect(movedPhoto.sectionId).toBe(milanSection.id)
    expect(movedPhoto.lockedFields).toContain('sectionId')

    traces = await listTraces(cookie, journey.id)
    const overriddenTrace = traces.find((t: any) => t.id === traceId)
    expect(overriddenTrace).toBeTruthy()
    expect(overriddenTrace.transportMode).toBe('flight')
    expect(overriddenTrace.transportModeReason).toBe('Set manually')

    // And the genuinely new stop should still show up as its own section —
    // reprocessing safety doesn't mean reprocessing stops working.
    const bergamoSection = sections.find((s: any) => s.id !== milanSection.id && s.id !== comoSection.id)
    expect(bergamoSection).toBeTruthy()
  }, 60_000)
})
