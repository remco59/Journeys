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
    body: JSON.stringify({ title: `Photo pipeline test ${Date.now()}`, startDate: '2026-08-17', endDate: '2026-08-21' })
  })
  return res.json()
}

async function uploadPhoto(cookie: string, journeyId: string, buffer: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename)
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, {
    method: 'POST',
    headers: { cookie },
    body: form
  })
  return { status: res.status, body: await res.json() }
}

async function waitForProcessing(cookie: string, journeyId: string, photoId: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, { headers: { cookie } })
    const photos = await res.json()
    const photo = photos.find((p: any) => p.id === photoId)
    if (photo?.storageKeyThumb) return photo
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Photo ${photoId} did not finish processing within ${timeoutMs}ms`)
}

let exiftool: ExifTool
let jpegWithGps: Buffer
let jpegNoGps: Buffer

beforeAll(async () => {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null)
  if (!health || !health.ok) {
    throw new Error(`Dev stack not reachable at ${BASE_URL} — run "docker compose up -d" first.`)
  }

  exiftool = new ExifTool()
  const base = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 120, g: 140, b: 160 } } })
    .jpeg()
    .toBuffer()

  const gpsPath = path.join(os.tmpdir(), `fixture-gps-${Date.now()}.jpg`)
  await fs.writeFile(gpsPath, base)
  await exiftool.write(
    gpsPath,
    {
      GPSLatitude: 45.4642,
      GPSLatitudeRef: 'N',
      GPSLongitude: 9.19,
      GPSLongitudeRef: 'E',
      DateTimeOriginal: '2026:08:17 13:42:00'
    },
    ['-overwrite_original']
  )
  jpegWithGps = await fs.readFile(gpsPath)

  const noGpsPath = path.join(os.tmpdir(), `fixture-nogps-${Date.now()}.jpg`)
  await fs.writeFile(noGpsPath, base)
  await exiftool.write(noGpsPath, { DateTimeOriginal: '2026:08:17 13:45:00' }, ['-overwrite_original'])
  jpegNoGps = await fs.readFile(noGpsPath)
}, 30_000)

afterAll(async () => {
  await exiftool?.end()
})

describe('photo upload and processing pipeline (live stack)', () => {
  it('extracts GPS/time, generates derivatives, and sets the journey cover photo', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const upload = await uploadPhoto(cookie, journey.id, jpegWithGps, 'milan.jpg')
    expect(upload.status).toBe(202)
    expect(upload.body.files[0].status).toBe('queued')
    const photoId = upload.body.files[0].photoId

    const photo = await waitForProcessing(cookie, journey.id, photoId)
    expect(photo.locationSource).toBe('exif')
    expect(photo.locationConfidence).toBe('high')
    expect(photo.capturedAt).toBeTruthy()
    expect(photo.storageKeyThumb).toBeTruthy()
    expect(photo.storageKeyPreview).toBeTruthy()

    // Cover photo auto-set to the first processed photo.
    const journeyRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, { headers: { cookie } })
    const refreshedJourney = await journeyRes.json()
    expect(refreshedJourney.coverPhotoId).toBe(photoId)

    // Thumbnail is actually downloadable, auth-gated, correctly typed.
    const thumbRes = await fetch(`${BASE_URL}/api/files/${encodeURIComponent(photo.storageKeyThumb)}`, {
      headers: { cookie }
    })
    expect(thumbRes.status).toBe(200)
    expect(thumbRes.headers.get('content-type')).toBe('image/webp')
  }, 30_000)

  it('leaves a GPS-less photo unresolved instead of guessing', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const upload = await uploadPhoto(cookie, journey.id, jpegNoGps, 'no-gps.jpg')
    const photoId = upload.body.files[0].photoId
    const photo = await waitForProcessing(cookie, journey.id, photoId)

    expect(photo.locationSource).toBe('unresolved')
    expect(photo.geom).toBeNull()
  }, 30_000)

  it('dedupes an identical re-upload by content checksum', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const first = await uploadPhoto(cookie, journey.id, jpegWithGps, 'a.jpg')
    expect(first.body.files[0].status).toBe('queued')

    const second = await uploadPhoto(cookie, journey.id, jpegWithGps, 'a-copy.jpg')
    expect(second.body.files[0].status).toBe('duplicate')
  })

  it('rejects a file whose content is not actually an image', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const fake = Buffer.from('not a real image')
    const upload = await uploadPhoto(cookie, journey.id, fake, 'totally-a.jpg')
    expect(upload.body.files[0].status).toBe('rejected')
  })

  it('never serves another user\'s photo file, even with a guessed storage key', async () => {
    const adminCookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(adminCookie)
    const upload = await uploadPhoto(adminCookie, journey.id, jpegWithGps, 'private.jpg')
    const photo = await waitForProcessing(adminCookie, journey.id, upload.body.files[0].photoId)

    const otherUsername = `photo-other-${Date.now()}`
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ username: otherUsername, password: 'a-fine-password', role: 'user' })
    })
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const res = await fetch(`${BASE_URL}/api/files/${encodeURIComponent(photo.storageKeyThumb)}`, {
      headers: { cookie: otherCookie }
    })
    expect(res.status).toBe(404)
  }, 30_000)
})
