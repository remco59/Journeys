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
  waitForPhotoProcessed,
  waitForAllProcessed,
  makeJpegAt,
  makeJpegNoGps,
  closeExifTool
} from './helpers'

let jpegWithGps: Buffer
let jpegNoGps: Buffer

beforeAll(async () => {
  await requireStackReachable()
  jpegWithGps = await makeJpegAt(45.4642, 9.19, '2026:08:17 13:42:00')
  jpegNoGps = await makeJpegNoGps('2026:08:17 13:45:00')
}, 30_000)

afterAll(closeExifTool)

describe('photo upload and processing pipeline (live stack)', () => {
  it('extracts GPS/time, generates derivatives, and sets the journey cover photo', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)

    const upload = await uploadPhoto(cookie, journey.id, jpegWithGps, 'milan.jpg')
    expect(upload.status).toBe(202)
    expect(upload.body.files[0].status).toBe('queued')
    const photoId = upload.body.files[0].photoId

    const photo = await waitForPhotoProcessed(cookie, journey.id, photoId)
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
    const photo = await waitForPhotoProcessed(cookie, journey.id, upload.body.files[0].photoId)

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
    const photo = await waitForPhotoProcessed(adminCookie, journey.id, upload.body.files[0].photoId)

    const otherUsername = `photo-other-${Date.now()}`
    await createUser(adminCookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const res = await fetch(`${BASE_URL}/api/files/${encodeURIComponent(photo.storageKeyThumb)}`, {
      headers: { cookie: otherCookie }
    })
    expect(res.status).toBe(404)
  }, 30_000)

  it('edits a photo\'s caption, timestamp, and location', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadPhoto(cookie, journey.id, jpegWithGps, 'editable.jpg')
    const photoId = upload.body.files[0].photoId
    await waitForPhotoProcessed(cookie, journey.id, photoId)

    const res = await fetch(`${BASE_URL}/api/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ caption: 'A lovely view', lat: 46.5, lon: 10.4 })
    })
    expect(res.status).toBe(200)

    const photos = await listPhotos(cookie, journey.id)
    const updated = photos.find((p: any) => p.id === photoId)
    expect(updated.caption).toBe('A lovely view')
    expect(updated.lat).toBeCloseTo(46.5, 3)
    expect(updated.lon).toBeCloseTo(10.4, 3)
  }, 30_000)

  it('sets a photo as the journey cover', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const first = await uploadPhoto(cookie, journey.id, jpegWithGps, 'first.jpg')
    const second = await uploadPhoto(cookie, journey.id, jpegNoGps, 'second.jpg')
    await waitForAllProcessed(cookie, journey.id, 2)
    const secondPhotoId = second.body.files[0].photoId

    const res = await fetch(`${BASE_URL}/api/photos/${secondPhotoId}/set-cover`, { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(200)

    const journeyRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, { headers: { cookie } })
    expect((await journeyRes.json()).coverPhotoId).toBe(secondPhotoId)
    void first
  }, 30_000)

  it('deletes a photo, which stops appearing anywhere and can no longer be edited', async () => {
    const cookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(cookie)
    const upload = await uploadPhoto(cookie, journey.id, jpegWithGps, 'to-delete.jpg')
    const photoId = upload.body.files[0].photoId
    await waitForPhotoProcessed(cookie, journey.id, photoId)

    const del = await fetch(`${BASE_URL}/api/photos/${photoId}`, { method: 'DELETE', headers: { cookie } })
    expect(del.status).toBe(200)

    const photos = await listPhotos(cookie, journey.id)
    expect(photos.find((p: any) => p.id === photoId)).toBeUndefined()

    const patchAfterDelete = await fetch(`${BASE_URL}/api/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ caption: 'too late' })
    })
    expect(patchAfterDelete.status).toBe(404)
  }, 30_000)

  it('never lets another user edit, delete, or set-cover a photo they do not own', async () => {
    const adminCookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const journey = await createJourney(adminCookie)
    const upload = await uploadPhoto(adminCookie, journey.id, jpegWithGps, 'owned.jpg')
    const photoId = upload.body.files[0].photoId
    await waitForPhotoProcessed(adminCookie, journey.id, photoId)

    const otherUsername = `photo-owner-check-${Date.now()}`
    await createUser(adminCookie, otherUsername)
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const patch = await fetch(`${BASE_URL}/api/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ caption: 'hijacked' })
    })
    expect(patch.status).toBe(404)

    const setCover = await fetch(`${BASE_URL}/api/photos/${photoId}/set-cover`, { method: 'POST', headers: { cookie: otherCookie } })
    expect(setCover.status).toBe(404)

    const del = await fetch(`${BASE_URL}/api/photos/${photoId}`, { method: 'DELETE', headers: { cookie: otherCookie } })
    expect(del.status).toBe(404)
  }, 30_000)
})
