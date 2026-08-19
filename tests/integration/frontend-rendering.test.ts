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
  makeJpegAt,
  closeExifTool
} from './helpers'

beforeAll(requireStackReachable, 15_000)
afterAll(closeExifTool)

/**
 * Guards against exactly the failure this test suite otherwise can't see:
 * every other integration test hits the API directly and would pass even
 * if the whole frontend component tree failed to render (as happened when
 * several components were referenced under the wrong Nuxt-auto-import
 * name — Vue drops an unresolvable component silently, with no HTTP-level
 * signal at all, only a dev-mode SSR warning). Fetching the real rendered
 * page and asserting no such warning appears in the SSR payload is the
 * cheapest check that actually catches that class of bug.
 */
async function assertNoUnresolvedComponents(path: string, cookie?: string) {
  const res = await fetch(`${BASE_URL}${path}`, cookie ? { headers: { cookie } } : undefined)
  expect(res.status, `${path} should render`).toBe(200)
  const html = await res.text()
  const warnings = html.match(/Failed to resolve component: \w+/g) ?? []
  expect(warnings, `${path} should have no unresolved-component warnings`).toEqual([])
}

describe('frontend renders with no unresolved Vue components (live stack)', () => {
  it('dashboard and all four journey views render cleanly, with photos and a section present', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const photo = await makeJpegAt(45.4642, 9.19, '2026:08:19 09:00:00')
    await uploadPhoto(cookie, journey.id, photo, 'a.jpg')
    await waitForAllProcessed(cookie, journey.id, 1)
    await clusterNow(cookie, journey.id)

    await assertNoUnresolvedComponents('/', cookie)
    await assertNoUnresolvedComponents(`/journeys/${journey.id}`, cookie)
    await assertNoUnresolvedComponents(`/journeys/${journey.id}/map`, cookie)
    await assertNoUnresolvedComponents(`/journeys/${journey.id}/story`, cookie)
    await assertNoUnresolvedComponents(`/journeys/${journey.id}/gallery`, cookie)
  }, 30_000)

  it('the shared read-only view renders cleanly too', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const shareRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/shares`, { method: 'POST', headers: { cookie } })
    const share = await shareRes.json()

    await assertNoUnresolvedComponents(`/shared/${share.token}`)
    await assertNoUnresolvedComponents(`/shared/${share.token}/story`)
  })
})
