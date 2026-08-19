import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  requireStackReachable,
  loginCookie,
  createJourney,
  uploadPhoto,
  listPhotos,
  listSections,
  clusterNow,
  waitForAllProcessed,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

describe('automatic section clustering (live stack)', () => {
  it('groups photos into two sections ~5km apart, in chronological order, and stays idempotent on rerun', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    // Milan-ish cluster: 3 photos within a couple of minutes.
    const milan = [
      await makeJpegAt(45.4642, 9.19, '2026:08:17 09:00:00'),
      await makeJpegAt(45.4643, 9.1901, '2026:08:17 09:01:00'),
      await makeJpegAt(45.4641, 9.1899, '2026:08:17 09:02:00')
    ]
    // A second cluster ~5km away, three hours later.
    const comoLike = [
      await makeJpegAt(45.4642, 9.256, '2026:08:17 12:00:00'),
      await makeJpegAt(45.4643, 9.2561, '2026:08:17 12:01:00')
    ]

    for (const [i, buf] of milan.entries()) await uploadPhoto(cookie, journey.id, buf, `milan-${i}.jpg`)
    for (const [i, buf] of comoLike.entries()) await uploadPhoto(cookie, journey.id, buf, `como-${i}.jpg`)

    await waitForAllProcessed(cookie, journey.id, 5)

    const result = await clusterNow(cookie, journey.id)
    expect(result.sectionsCreated).toBe(2)

    const sections = await listSections(cookie, journey.id)
    expect(sections).toHaveLength(2)

    // Chronological order.
    expect(new Date(sections[0].arrivalAt).getTime()).toBeLessThan(new Date(sections[1].arrivalAt).getTime())
    expect(sections[0].placeName).toBeTruthy()
    expect(sections[1].placeName).toBeTruthy()

    const photos = await listPhotos(cookie, journey.id)
    const bySection = new Map<string, number>()
    for (const p of photos) {
      if (!p.sectionId) continue
      bySection.set(p.sectionId, (bySection.get(p.sectionId) ?? 0) + 1)
    }
    expect([...bySection.values()].sort()).toEqual([2, 3])

    // Rerunning clustering with no new data should not create or duplicate sections.
    const rerunResult = await clusterNow(cookie, journey.id)
    expect(rerunResult.sectionsCreated).toBe(0)

    const sectionsAfterRerun = await listSections(cookie, journey.id)
    expect(sectionsAfterRerun).toHaveLength(2)
  }, 40_000)

  it('stays stable (no duplicate sections, no spurious updates) across repeated reclustering with no new data', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const photosBuf = [
      await makeJpegAt(46.5, 10.4, '2026:08:18 08:00:00'),
      await makeJpegAt(46.5001, 10.4001, '2026:08:18 08:01:00')
    ]
    for (const [i, buf] of photosBuf.entries()) await uploadPhoto(cookie, journey.id, buf, `stelvio-${i}.jpg`)
    await waitForAllProcessed(cookie, journey.id, 2)

    await clusterNow(cookie, journey.id)
    const sections = await listSections(cookie, journey.id)
    expect(sections).toHaveLength(1)

    const rerunResult = await clusterNow(cookie, journey.id)
    expect(rerunResult.sectionsCreated).toBe(0)
    expect(rerunResult.sectionsUpdated).toBe(0)
    expect(rerunResult.photosAssigned).toBe(0)
  }, 40_000)
})
