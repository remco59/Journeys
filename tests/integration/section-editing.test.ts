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
  listPhotos,
  listSections,
  clusterNow,
  waitForAllProcessed,
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

async function setUpTwoSectionJourney(cookie: string) {
  const journey = await createJourney(cookie)
  const milan = [
    await makeJpegAt(45.4642, 9.19, '2026:08:17 09:00:00'),
    await makeJpegAt(45.4643, 9.1901, '2026:08:17 09:01:00')
  ]
  const como = [
    await makeJpegAt(45.4642, 9.256, '2026:08:17 12:00:00'),
    await makeJpegAt(45.4643, 9.2561, '2026:08:17 12:01:00')
  ]
  for (const [i, buf] of milan.entries()) await uploadPhoto(cookie, journey.id, buf, `milan-${i}.jpg`)
  for (const [i, buf] of como.entries()) await uploadPhoto(cookie, journey.id, buf, `como-${i}.jpg`)
  await waitForAllProcessed(cookie, journey.id, 4)
  await clusterNow(cookie, journey.id)
  const sections = await listSections(cookie, journey.id)
  return { journey, sections }
}

describe('manual section editing (live stack)', () => {
  it('a manually renamed section survives a forced re-run of clustering', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { journey, sections } = await setUpTwoSectionJourney(cookie)
    const target = sections[0]

    const renameRes = await fetch(`${BASE_URL}/api/sections/${target.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'My Custom Title' })
    })
    expect(renameRes.status).toBe(200)
    const renamed = await renameRes.json()
    expect(renamed.title).toBe('My Custom Title')
    expect(renamed.lockedFields).toContain('title')
    expect(renamed.source).toBe('user_override')

    await clusterNow(cookie, journey.id)

    const sectionsAfter = await listSections(cookie, journey.id)
    const stillThere = sectionsAfter.find((s: any) => s.id === target.id)
    expect(stillThere.title).toBe('My Custom Title')
  }, 40_000)

  it('moving a photo to another section survives reclustering', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { journey, sections } = await setUpTwoSectionJourney(cookie)
    const [sectionA, sectionB] = sections
    const photos = await listPhotos(cookie, journey.id)
    const photoFromA = photos.find((p: any) => p.sectionId === sectionA.id)

    const moveRes = await fetch(`${BASE_URL}/api/photos/${photoFromA.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ sectionId: sectionB.id })
    })
    expect(moveRes.status).toBe(200)
    const moved = await moveRes.json()
    expect(moved.sectionId).toBe(sectionB.id)
    expect(moved.lockedFields).toContain('sectionId')

    await clusterNow(cookie, journey.id)

    const photosAfter = await listPhotos(cookie, journey.id)
    const stillMoved = photosAfter.find((p: any) => p.id === photoFromA.id)
    expect(stillMoved.sectionId).toBe(sectionB.id)
  }, 40_000)

  it('creates a manual section with all provided fields locked', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const res = await fetch(`${BASE_URL}/api/journeys/${journey.id}/sections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ title: 'Stelvio Pass', lat: 46.5253, lon: 10.4525 })
    })
    expect(res.status).toBe(201)
    const section = await res.json()
    expect(section.title).toBe('Stelvio Pass')
    expect(section.source).toBe('user_override')
    expect(section.lockedFields.sort()).toEqual(['geom', 'title'])
  })

  it('merges two sections, moving all photos and deleting the source', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { journey, sections } = await setUpTwoSectionJourney(cookie)
    const [sectionA, sectionB] = sections

    const mergeRes = await fetch(`${BASE_URL}/api/sections/${sectionA.id}/merge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ intoSectionId: sectionB.id })
    })
    expect(mergeRes.status).toBe(200)
    const result = await mergeRes.json()
    expect(result.movedPhotos).toBe(2)

    const sectionsAfter = await listSections(cookie, journey.id)
    expect(sectionsAfter.find((s: any) => s.id === sectionA.id)).toBeUndefined()
    expect(sectionsAfter).toHaveLength(1)

    const photosAfter = await listPhotos(cookie, journey.id)
    expect(photosAfter.every((p: any) => p.sectionId === sectionB.id)).toBe(true)
  }, 40_000)

  it('splits a section by moving selected photos into a new one', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { journey, sections } = await setUpTwoSectionJourney(cookie)
    const target = sections[0]
    const photos = await listPhotos(cookie, journey.id)
    const inTarget = photos.filter((p: any) => p.sectionId === target.id)
    expect(inTarget.length).toBeGreaterThanOrEqual(2)
    const toSplit = [inTarget[0].id]

    const splitRes = await fetch(`${BASE_URL}/api/sections/${target.id}/split`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ photoIds: toSplit, title: 'Split off' })
    })
    expect(splitRes.status).toBe(201)
    const newSection = await splitRes.json()
    expect(newSection.title).toBe('Split off')

    const photosAfter = await listPhotos(cookie, journey.id)
    const movedPhoto = photosAfter.find((p: any) => p.id === toSplit[0])
    expect(movedPhoto.sectionId).toBe(newSection.id)

    const sectionsAfter = await listSections(cookie, journey.id)
    expect(sectionsAfter).toHaveLength(3)
  }, 40_000)

  it('deleting a section unassigns its photos instead of deleting them', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { journey, sections } = await setUpTwoSectionJourney(cookie)
    const target = sections[0]

    const deleteRes = await fetch(`${BASE_URL}/api/sections/${target.id}`, { method: 'DELETE', headers: { cookie } })
    expect(deleteRes.status).toBe(200)

    const photosAfter = await listPhotos(cookie, journey.id)
    expect(photosAfter).toHaveLength(4)
    const orphaned = photosAfter.filter((p: any) => p.sectionId === null)
    expect(orphaned.length).toBeGreaterThanOrEqual(2)
  }, 40_000)

  it('never lets another user edit, merge, split, or delete a section they do not own', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const { sections } = await setUpTwoSectionJourney(cookie)
    const [sectionA, sectionB] = sections

    const otherUsername = `section-other-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const patchRes = await fetch(`${BASE_URL}/api/sections/${sectionA.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ title: 'Hijacked' })
    })
    expect(patchRes.status).toBe(404)

    const mergeRes = await fetch(`${BASE_URL}/api/sections/${sectionA.id}/merge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ intoSectionId: sectionB.id })
    })
    expect(mergeRes.status).toBe(404)

    const deleteRes = await fetch(`${BASE_URL}/api/sections/${sectionA.id}`, { method: 'DELETE', headers: { cookie: otherCookie } })
    expect(deleteRes.status).toBe(404)
  }, 40_000)
})
