import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { journeys, photos, sections } from '../../db/schema'
import type { CreateJourneyInput, UpdateJourneyInput } from '../../../shared/types/journeys'

/**
 * Journeys-overview shape: one row per journey plus the counts and cover
 * image the card needs, resolved server-side so the page never fans out
 * into a photos/sections request per card. Cover falls back to the
 * earliest-captured photo — the same photo JourneyHero falls back to when
 * a journey has no coverPhotoId (photos are listed capturedAt-ascending
 * there too).
 */
export async function listJourneySummariesForOwner(ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({
      id: journeys.id,
      title: journeys.title,
      startDate: journeys.startDate,
      endDate: journeys.endDate,
      coverPhotoId: journeys.coverPhotoId,
      updatedAt: journeys.updatedAt
    })
    .from(journeys)
    .where(eq(journeys.ownerId, ownerId))
    .orderBy(desc(journeys.updatedAt), desc(journeys.startDate))

  if (rows.length === 0) return []

  const journeyIds = rows.map((r) => r.id)

  const sectionCounts = await db
    .select({ journeyId: sections.journeyId, count: sql<number>`count(*)::int` })
    .from(sections)
    .where(inArray(sections.journeyId, journeyIds))
    .groupBy(sections.journeyId)
  const sectionCountByJourney = new Map(sectionCounts.map((r) => [r.journeyId, r.count]))

  // All photo rows for these journeys, oldest-captured first, so the first
  // Map entry per journey ends up being the earliest-captured photo.
  const journeyPhotos = await db
    .select({
      journeyId: photos.journeyId,
      storageKeyPreview: photos.storageKeyPreview,
      storageKeyThumb: photos.storageKeyThumb
    })
    .from(photos)
    .where(inArray(photos.journeyId, journeyIds))
    .orderBy(asc(photos.capturedAt), asc(photos.createdAt))
  const firstPhotoByJourney = new Map<string, { storageKeyPreview: string | null; storageKeyThumb: string | null }>()
  for (const photo of journeyPhotos) {
    if (!firstPhotoByJourney.has(photo.journeyId)) firstPhotoByJourney.set(photo.journeyId, photo)
  }

  const explicitCoverIds = [...new Set(rows.map((r) => r.coverPhotoId).filter((id): id is string => !!id))]
  const explicitCovers = explicitCoverIds.length
    ? await db
        .select({ id: photos.id, storageKeyPreview: photos.storageKeyPreview, storageKeyThumb: photos.storageKeyThumb })
        .from(photos)
        .where(inArray(photos.id, explicitCoverIds))
    : []
  const explicitCoverById = new Map(explicitCovers.map((p) => [p.id, p]))

  return rows.map((journey) => {
    const explicit = journey.coverPhotoId ? explicitCoverById.get(journey.coverPhotoId) : undefined
    const fallback = firstPhotoByJourney.get(journey.id)
    const cover = explicit
      ? { storageKeyPreview: explicit.storageKeyPreview, storageKeyThumb: explicit.storageKeyThumb }
      : (fallback ?? null)

    return {
      id: journey.id,
      title: journey.title,
      startDate: journey.startDate,
      endDate: journey.endDate,
      updatedAt: journey.updatedAt,
      sectionsCount: sectionCountByJourney.get(journey.id) ?? 0,
      cover
    }
  })
}

export async function getJourneyById(id: string) {
  const db = useDb()
  const rows = await db.select().from(journeys).where(eq(journeys.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getJourneyForOwner(id: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createJourney(ownerId: string, input: CreateJourneyInput) {
  const db = useDb()
  const [row] = await db
    .insert(journeys)
    .values({
      ownerId,
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate,
      endDate: input.endDate
    })
    .returning()
  return row! // a single-row insert always returns exactly one row
}

export async function updateJourney(id: string, ownerId: string, input: UpdateJourneyInput) {
  const db = useDb()
  const [row] = await db
    .update(journeys)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .returning()
  return row ?? null
}

export async function deleteJourney(id: string, ownerId: string) {
  const db = useDb()
  const [row] = await db
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .returning({ id: journeys.id })
  return row ?? null
}
