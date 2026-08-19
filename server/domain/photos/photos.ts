import { and, eq, or } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { photos, journeys } from '../../db/schema'
import type { ExtractedPhotoMetadata } from './exif'
import type { UpdatePhotoInput } from '../../../shared/types/photos'

export async function createPendingPhoto(input: { journeyId: string; importFileId: string; storageKeyOriginal: string }) {
  const db = useDb()
  const [row] = await db
    .insert(photos)
    .values({
      journeyId: input.journeyId,
      importFileId: input.importFileId,
      storageKeyOriginal: input.storageKeyOriginal
    })
    .returning()
  return row! // a single-row insert always returns exactly one row
}

export async function getPhotoById(id: string) {
  const db = useDb()
  const rows = await db.select().from(photos).where(eq(photos.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getPhotoForOwner(id: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ photo: photos })
    .from(photos)
    .innerJoin(journeys, eq(photos.journeyId, journeys.id))
    .where(and(eq(photos.id, id), eq(journeys.ownerId, ownerId)))
    .limit(1)
  return rows[0]?.photo ?? null
}

export async function getPhotoByStorageKey(key: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(photos)
    .where(or(eq(photos.storageKeyOriginal, key), eq(photos.storageKeyPreview, key), eq(photos.storageKeyThumb, key)))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Never matches storageKeyOriginal — shared/public visitors only ever see
 * derived thumb/preview images, never the original file (§22). A request
 * for an original's key, even with a valid share token, must 404.
 */
export async function getPhotoByPublicStorageKey(key: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(photos)
    .where(or(eq(photos.storageKeyPreview, key), eq(photos.storageKeyThumb, key)))
    .limit(1)
  return rows[0] ?? null
}

export async function listPhotosForJourney(journeyId: string) {
  const db = useDb()
  return db.select().from(photos).where(eq(photos.journeyId, journeyId)).orderBy(photos.capturedAt)
}

export async function listPhotosForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ photo: photos })
    .from(photos)
    .innerJoin(journeys, eq(photos.journeyId, journeys.id))
    .where(and(eq(photos.journeyId, journeyId), eq(journeys.ownerId, ownerId)))
    .orderBy(photos.capturedAt)
  return rows.map((r) => r.photo)
}

export async function applyExtractedMetadata(
  photoId: string,
  meta: ExtractedPhotoMetadata,
  derived: { storageKeyPreview: string; storageKeyThumb: string }
) {
  const db = useDb()
  const hasGps = meta.lat != null && meta.lon != null
  await db
    .update(photos)
    .set({
      capturedAt: meta.capturedAt,
      tzOffsetMinutes: meta.tzOffsetMinutes,
      geom: hasGps ? { lat: meta.lat!, lon: meta.lon! } : null,
      altitudeM: meta.altitudeM,
      orientation: meta.orientation,
      cameraMake: meta.cameraMake,
      cameraModel: meta.cameraModel,
      exif: meta.raw,
      locationSource: hasGps ? 'exif' : 'unresolved',
      locationConfidence: hasGps ? 'high' : 'inferred',
      storageKeyPreview: derived.storageKeyPreview,
      storageKeyThumb: derived.storageKeyThumb
    })
    .where(eq(photos.id, photoId))
}

/**
 * Every field the caller touches becomes both the new value AND a locked
 * field — this is what makes a manual edit survive future reprocessing
 * (§12). Moving a photo to a different section, in particular, sets
 * source='manual' on locationSource only when the location itself changed.
 */
export async function updatePhotoWithLocks(photo: typeof photos.$inferSelect, input: UpdatePhotoInput) {
  const db = useDb()
  const patch: Partial<typeof photos.$inferInsert> = {}
  const newLocks = new Set(photo.lockedFields)

  if (input.sectionId !== undefined) {
    patch.sectionId = input.sectionId
    newLocks.add('sectionId')
  }
  if (input.caption !== undefined) {
    patch.caption = input.caption
    newLocks.add('caption')
  }
  if (input.capturedAt !== undefined) {
    patch.capturedAt = new Date(input.capturedAt)
    newLocks.add('capturedAt')
  }
  if (input.lat !== undefined && input.lon !== undefined) {
    patch.geom = { lat: input.lat, lon: input.lon }
    patch.locationSource = 'manual'
    patch.locationConfidence = 'high'
    newLocks.add('geom')
  }

  patch.source = 'user_override'
  patch.lockedFields = [...newLocks]

  const [updated] = await db.update(photos).set(patch).where(eq(photos.id, photo.id)).returning()
  return updated!
}

/** "The first suitable uploaded photo can automatically become the cover photo." */
export async function maybeSetJourneyCover(journeyId: string, photoId: string) {
  const db = useDb()
  const [journey] = await db.select({ coverPhotoId: journeys.coverPhotoId }).from(journeys).where(eq(journeys.id, journeyId)).limit(1)
  if (journey && !journey.coverPhotoId) {
    await db.update(journeys).set({ coverPhotoId: photoId }).where(eq(journeys.id, journeyId))
  }
}
