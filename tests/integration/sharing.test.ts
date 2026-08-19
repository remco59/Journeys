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

async function createShare(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/shares`, { method: 'POST', headers: { cookie } })
  return { status: res.status, body: await res.json() }
}

describe('public share links (live stack)', () => {
  it('lets an anonymous visitor browse a shared journey\'s data with no session at all', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie, 'Shared trip')
    const photo = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    await uploadPhoto(cookie, journey.id, photo, 'a.jpg')
    await waitForAllProcessed(cookie, journey.id, 1)
    await clusterNow(cookie, journey.id)

    const share = await createShare(cookie, journey.id)
    expect(share.status).toBe(201)
    const token = share.body.token
    expect(token.length).toBeGreaterThan(15)

    const journeyRes = await fetch(`${BASE_URL}/api/shared/${token}/journey`)
    expect(journeyRes.status).toBe(200)
    const publicJourney = await journeyRes.json()
    expect(publicJourney.title).toBe('Shared trip')
    expect(publicJourney.id).toBeUndefined() // internal id never exposed

    const sectionsRes = await fetch(`${BASE_URL}/api/shared/${token}/sections`)
    const sections = await sectionsRes.json()
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].lockedFields).toBeUndefined()
    expect(sections[0].source).toBeUndefined()

    const photosRes = await fetch(`${BASE_URL}/api/shared/${token}/photos`)
    const photos = await photosRes.json()
    expect(photos).toHaveLength(1)
    expect(photos[0].exif).toBeUndefined()
    expect(photos[0].cameraMake).toBeUndefined()
    expect(photos[0].storageKeyOriginal).toBeUndefined()

    const thumbRes = await fetch(`${BASE_URL}/api/shared/${token}/files/${encodeURIComponent(photos[0].storageKeyThumb)}`)
    expect(thumbRes.status).toBe(200)
    expect(thumbRes.headers.get('content-type')).toBe('image/webp')
  }, 40_000)

  it('404s immediately on every endpoint once a link is revoked', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const share = await createShare(cookie, journey.id)
    const token = share.body.token

    expect((await fetch(`${BASE_URL}/api/shared/${token}/journey`)).status).toBe(200)

    const revokeRes = await fetch(`${BASE_URL}/api/shares/${share.body.id}`, { method: 'DELETE', headers: { cookie } })
    expect(revokeRes.status).toBe(200)

    for (const path of ['journey', 'sections', 'photos', 'traces', 'activities']) {
      const res = await fetch(`${BASE_URL}/api/shared/${token}/${path}`)
      expect(res.status).toBe(404)
    }
  })

  it('404s for a token that never existed, indistinguishable from a revoked one', async () => {
    const res = await fetch(`${BASE_URL}/api/shared/not-a-real-token-at-all/journey`)
    expect(res.status).toBe(404)
  })

  it('never serves a photo original through the shared files route, even with a valid token', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const photo = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    const upload = await uploadPhoto(cookie, journey.id, photo, 'a.jpg')
    await waitForAllProcessed(cookie, journey.id, 1)

    const privatePhotosRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/photos`, { headers: { cookie } })
    const privatePhotos = await privatePhotosRes.json()
    const originalKey = privatePhotos[0].storageKeyOriginal

    const share = await createShare(cookie, journey.id)
    const res = await fetch(`${BASE_URL}/api/shared/${share.body.token}/files/${encodeURIComponent(originalKey)}`)
    expect(res.status).toBe(404)
  }, 30_000)

  it('grants no write capability at all — there is no authenticated session for an anonymous share visitor to mutate with', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    await createShare(cookie, journey.id)

    // An anonymous visitor's browser carries no journeys_session cookie at
    // all — every mutating route requires one regardless of any share
    // token, since /api/shared/* is a structurally separate, read-only
    // route group with no PATCH/POST/DELETE handlers in it.
    const res = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked with no session' })
    })
    expect(res.status).toBe(401)
  })

  it('only the owner can create, list, or revoke share links for a journey', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const otherUsername = `share-other-${Date.now()}`
    await createUser(cookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const createRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/shares`, { method: 'POST', headers: { cookie: otherCookie } })
    expect(createRes.status).toBe(404)

    const listRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/shares`, { headers: { cookie: otherCookie } })
    expect(listRes.status).toBe(404)

    const share = await createShare(cookie, journey.id)
    const revokeRes = await fetch(`${BASE_URL}/api/shares/${share.body.id}`, { method: 'DELETE', headers: { cookie: otherCookie } })
    expect(revokeRes.status).toBe(404)
  })

  it('lists both active and revoked shares for the owner', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const share = await createShare(cookie, journey.id)
    await fetch(`${BASE_URL}/api/shares/${share.body.id}`, { method: 'DELETE', headers: { cookie } })
    await createShare(cookie, journey.id)

    const listRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/shares`, { headers: { cookie } })
    const shares = await listRes.json()
    expect(shares).toHaveLength(2)
    expect(shares.filter((s: any) => s.revokedAt).length).toBe(1)
    expect(shares.filter((s: any) => !s.revokedAt).length).toBe(1)
  })
})
