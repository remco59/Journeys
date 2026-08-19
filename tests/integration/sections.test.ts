import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import sharp from 'sharp'
import { ExifTool } from 'exiftool-vendored'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'
const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'change-me-now'

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Expected a Set-Cookie header')
  return raw.split(';')[0]
}

async function loginCookie(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return extractSessionCookie(res)
}

async function createJourney(cookie: string) {
  const res = await fetch(`${BASE_URL}/api/journeys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ title: `Sections test ${Date.now()}`, startDate: '2026-08-17', endDate: '2026-08-21' })
  })
  return res.json()
}

async function uploadPhoto(cookie: string, journeyId: string, buffer: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename)
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, { method: 'POST', headers: { cookie }, body: form })
  return res.json()
}

async function waitForAllProcessed(cookie: string, journeyId: string, expectedCount: number, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, { headers: { cookie } })
    const photos = await res.json()
    if (photos.length >= expectedCount && photos.every((p: any) => p.storageKeyThumb)) return photos
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Photos did not finish processing within ${timeoutMs}ms`)
}

let exiftool: ExifTool
let baseJpeg: Buffer

async function makeJpegAt(lat: number, lon: number, dateTimeOriginal: string): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `sections-fixture-${Math.random().toString(36).slice(2)}.jpg`)
  await fs.writeFile(tmp, baseJpeg)
  await exiftool.write(
    tmp,
    { GPSLatitude: lat, GPSLatitudeRef: lat >= 0 ? 'N' : 'S', GPSLongitude: lon, GPSLongitudeRef: lon >= 0 ? 'E' : 'W', DateTimeOriginal: dateTimeOriginal },
    ['-overwrite_original']
  )
  const buf = await fs.readFile(tmp)
  await fs.rm(tmp, { force: true })
  return buf
}

beforeAll(async () => {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null)
  if (!health || !health.ok) {
    throw new Error(`Dev stack not reachable at ${BASE_URL} — run "docker compose up -d" first.`)
  }
  exiftool = new ExifTool()
  baseJpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 90, g: 130, b: 170 } } }).jpeg().toBuffer()
}, 30_000)

afterAll(async () => {
  await exiftool?.end()
})

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

    const clusterRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/cluster`, { method: 'POST', headers: { cookie } })
    expect(clusterRes.status).toBe(200)
    const result = await clusterRes.json()
    expect(result.sectionsCreated).toBe(2)

    const sectionsRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/sections`, { headers: { cookie } })
    const sections = await sectionsRes.json()
    expect(sections).toHaveLength(2)

    // Chronological order.
    expect(new Date(sections[0].arrivalAt).getTime()).toBeLessThan(new Date(sections[1].arrivalAt).getTime())
    expect(sections[0].placeName).toBeTruthy()
    expect(sections[1].placeName).toBeTruthy()

    const photosRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}/photos`, { headers: { cookie } })
    const photos = await photosRes.json()
    const bySection = new Map<string, number>()
    for (const p of photos) {
      if (!p.sectionId) continue
      bySection.set(p.sectionId, (bySection.get(p.sectionId) ?? 0) + 1)
    }
    expect([...bySection.values()].sort()).toEqual([2, 3])

    // Rerunning clustering with no new data should not create or duplicate sections.
    const rerun = await fetch(`${BASE_URL}/api/journeys/${journey.id}/cluster`, { method: 'POST', headers: { cookie } })
    const rerunResult = await rerun.json()
    expect(rerunResult.sectionsCreated).toBe(0)

    const sectionsAfterRerun = await (await fetch(`${BASE_URL}/api/journeys/${journey.id}/sections`, { headers: { cookie } })).json()
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

    await fetch(`${BASE_URL}/api/journeys/${journey.id}/cluster`, { method: 'POST', headers: { cookie } })
    const sections = await (await fetch(`${BASE_URL}/api/journeys/${journey.id}/sections`, { headers: { cookie } })).json()
    expect(sections).toHaveLength(1)
    const rerun = await fetch(`${BASE_URL}/api/journeys/${journey.id}/cluster`, { method: 'POST', headers: { cookie } })
    const rerunResult = await rerun.json()
    expect(rerunResult.sectionsCreated).toBe(0)
    expect(rerunResult.sectionsUpdated).toBe(0)
    expect(rerunResult.photosAssigned).toBe(0)
  }, 40_000)
})
