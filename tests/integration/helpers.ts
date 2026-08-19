import sharp from 'sharp'
import { ExifTool } from 'exiftool-vendored'
import { Encoder, Profile } from '@garmin/fitsdk'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'
export const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin'
export const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'change-me-now'

export function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Expected a Set-Cookie header')
  return raw.split(';')[0]!
}

export async function requireStackReachable() {
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null)
  if (!health || !health.ok) {
    throw new Error(`Dev stack not reachable at ${BASE_URL} — run "docker compose up -d" first.`)
  }
}

export async function loginCookie(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) throw new Error(`login failed for ${username}: ${res.status}`)
  return extractSessionCookie(res)
}

export async function createUser(adminCookie: string, username: string, password = 'a-fine-password') {
  const res = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ username, password, role: 'user' })
  })
  if (!res.ok) throw new Error(`user creation failed: ${res.status}`)
  return res.json()
}

export async function createJourney(cookie: string, title = `Test journey ${Date.now()}`) {
  const res = await fetch(`${BASE_URL}/api/journeys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ title, startDate: '2026-08-17', endDate: '2026-08-21' })
  })
  return res.json()
}

export async function uploadPhoto(cookie: string, journeyId: string, buffer: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename)
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, { method: 'POST', headers: { cookie }, body: form })
  return { status: res.status, body: await res.json() }
}

export async function listPhotos(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/photos`, { headers: { cookie } })
  return res.json()
}

export async function listSections(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/sections`, { headers: { cookie } })
  return res.json()
}

export async function clusterNow(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/cluster`, { method: 'POST', headers: { cookie } })
  return res.json()
}

export async function listActivities(cookie: string, journeyId: string) {
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/activities`, { headers: { cookie } })
  return res.json()
}

export async function uploadActivity(cookie: string, journeyId: string, buffer: Buffer, filename: string) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'application/gpx+xml' }), filename)
  const res = await fetch(`${BASE_URL}/api/journeys/${journeyId}/activities`, { method: 'POST', headers: { cookie }, body: form })
  return { status: res.status, body: await res.json() }
}

export type ActivityPoint = { lat: number; lon: number; ele?: number; time: string; heartRate?: number }

export function makeTcx(points: ActivityPoint[], sport: string): Buffer {
  const trackpoints = points
    .map(
      (p) => `<Trackpoint>
        <Time>${p.time}</Time>
        <Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>
        ${p.ele != null ? `<AltitudeMeters>${p.ele}</AltitudeMeters>` : ''}
        ${p.heartRate != null ? `<HeartRateBpm><Value>${p.heartRate}</Value></HeartRateBpm>` : ''}
      </Trackpoint>`
    )
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${points[0]?.time ?? ''}</Id>
      <Lap><Track>${trackpoints}</Track></Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`
  return Buffer.from(xml, 'utf-8')
}

function toSemicircles(deg: number): number {
  return Math.round(deg * (2 ** 31 / 180))
}

export function makeFit(points: ActivityPoint[], sport: string): Buffer {
  const encoder = new Encoder()
  const first = points[0]!
  const last = points[points.length - 1]!

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    timeCreated: new Date(first.time),
    serialNumber: 1
  })

  for (const p of points) {
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.RECORD,
      timestamp: new Date(p.time),
      positionLat: toSemicircles(p.lat),
      positionLong: toSemicircles(p.lon),
      ...(p.ele != null ? { altitude: p.ele } : {}),
      ...(p.heartRate != null ? { heartRate: p.heartRate } : {})
    })
  }

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.SESSION,
    timestamp: new Date(last.time),
    startTime: new Date(first.time),
    sport,
    totalElapsedTime: (new Date(last.time).getTime() - new Date(first.time).getTime()) / 1000
  })

  return Buffer.from(encoder.close())
}

export type GpxPoint = { lat: number; lon: number; ele?: number; time: string }

export function makeGpx(points: GpxPoint[], opts: { name?: string; type?: string } = {}): Buffer {
  const trkpts = points
    .map(
      (p) =>
        `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele != null ? `<ele>${p.ele}</ele>` : ''}<time>${p.time}</time></trkpt>`
    )
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="journeys-tests" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    ${opts.name ? `<name>${opts.name}</name>` : ''}
    ${opts.type ? `<type>${opts.type}</type>` : ''}
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`
  return Buffer.from(xml, 'utf-8')
}

export async function waitForAllProcessed(cookie: string, journeyId: string, expectedCount: number, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const photos = await listPhotos(cookie, journeyId)
    if (photos.length >= expectedCount && photos.every((p: any) => p.storageKeyThumb)) return photos
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Photos did not finish processing within ${timeoutMs}ms`)
}

export async function waitForPhotoProcessed(cookie: string, journeyId: string, photoId: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const photos = await listPhotos(cookie, journeyId)
    const photo = photos.find((p: any) => p.id === photoId)
    if (photo?.storageKeyThumb) return photo
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Photo ${photoId} did not finish processing within ${timeoutMs}ms`)
}

let sharedExiftool: ExifTool | undefined
let sharedBaseJpeg: Buffer | undefined

export function getExifTool(): ExifTool {
  if (!sharedExiftool) sharedExiftool = new ExifTool()
  return sharedExiftool
}

export async function closeExifTool() {
  if (sharedExiftool) {
    await sharedExiftool.end()
    sharedExiftool = undefined
  }
}

async function getBaseJpeg(): Promise<Buffer> {
  if (!sharedBaseJpeg) {
    sharedBaseJpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 90, g: 130, b: 170 } } })
      .jpeg()
      .toBuffer()
  }
  return sharedBaseJpeg
}

export async function makeJpegAt(lat: number, lon: number, dateTimeOriginal: string): Promise<Buffer> {
  const base = await getBaseJpeg()
  const tmp = path.join(os.tmpdir(), `fixture-${Math.random().toString(36).slice(2)}.jpg`)
  await fs.writeFile(tmp, base)
  await getExifTool().write(
    tmp,
    {
      GPSLatitude: lat,
      GPSLatitudeRef: lat >= 0 ? 'N' : 'S',
      GPSLongitude: lon,
      GPSLongitudeRef: lon >= 0 ? 'E' : 'W',
      DateTimeOriginal: dateTimeOriginal
    },
    ['-overwrite_original']
  )
  const buf = await fs.readFile(tmp)
  await fs.rm(tmp, { force: true })
  return buf
}

export async function makeJpegNoGps(dateTimeOriginal: string): Promise<Buffer> {
  const base = await getBaseJpeg()
  const tmp = path.join(os.tmpdir(), `fixture-nogps-${Math.random().toString(36).slice(2)}.jpg`)
  await fs.writeFile(tmp, base)
  await getExifTool().write(tmp, { DateTimeOriginal: dateTimeOriginal }, ['-overwrite_original'])
  const buf = await fs.readFile(tmp)
  await fs.rm(tmp, { force: true })
  return buf
}
