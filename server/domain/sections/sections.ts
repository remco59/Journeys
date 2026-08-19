import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, journeys, photos } from '../../db/schema'
import { geoPointSelect } from '../../db/postgis'
import type { CreateSectionInput, UpdateSectionInput } from '../../../shared/types/sections'

export async function listSectionsForJourney(journeyId: string) {
  const db = useDb()
  return db.select().from(sections).where(eq(sections.journeyId, journeyId)).orderBy(sections.orderIndex)
}

/** Includes lat/lon (projected out of the otherwise write-only geom column) — the Map view needs real coordinates. */
export async function listSectionsForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ section: sections, ...geoPointSelect(sections.geom) })
    .from(sections)
    .innerJoin(journeys, eq(sections.journeyId, journeys.id))
    .where(and(eq(sections.journeyId, journeyId), eq(journeys.ownerId, ownerId)))
    .orderBy(sections.orderIndex)
  return rows.map((r) => ({ ...r.section, lat: r.lat, lon: r.lon }))
}

export async function getSectionForOwner(sectionId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ section: sections })
    .from(sections)
    .innerJoin(journeys, eq(sections.journeyId, journeys.id))
    .where(and(eq(sections.id, sectionId), eq(journeys.ownerId, ownerId)))
    .limit(1)
  return rows[0]?.section ?? null
}

export async function reindexSectionOrder(journeyId: string): Promise<void> {
  const db = useDb()
  const all = await db
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.journeyId, journeyId))
    .orderBy(sections.arrivalAt)
  for (let i = 0; i < all.length; i++) {
    await db.update(sections).set({ orderIndex: i }).where(eq(sections.id, all[i]!.id))
  }
}

/** Every field the caller actually supplied becomes both the new value AND a locked field. */
export async function createSection(journeyId: string, input: CreateSectionInput) {
  const db = useDb()
  const lockedFields: string[] = ['title']
  if (input.placeName !== undefined) lockedFields.push('placeName')
  if (input.description !== undefined) lockedFields.push('description')
  if (input.lat !== undefined && input.lon !== undefined) lockedFields.push('geom')
  if (input.arrivalAt !== undefined) lockedFields.push('arrivalAt')
  if (input.departureAt !== undefined) lockedFields.push('departureAt')

  const [created] = await db
    .insert(sections)
    .values({
      journeyId,
      title: input.title,
      placeName: input.placeName ?? null,
      description: input.description ?? null,
      geom: input.lat !== undefined && input.lon !== undefined ? { lat: input.lat, lon: input.lon } : null,
      arrivalAt: input.arrivalAt ? new Date(input.arrivalAt) : null,
      departureAt: input.departureAt ? new Date(input.departureAt) : null,
      confidence: 'high',
      source: 'user_override',
      lockedFields
    })
    .returning()

  await reindexSectionOrder(journeyId)
  return created!
}

export async function updateSectionFields(section: typeof sections.$inferSelect, input: UpdateSectionInput) {
  const db = useDb()
  const patch: Partial<typeof sections.$inferInsert> = {}
  const newLocks = new Set(section.lockedFields)

  if (input.title !== undefined) {
    patch.title = input.title
    newLocks.add('title')
  }
  if (input.placeName !== undefined) {
    patch.placeName = input.placeName
    newLocks.add('placeName')
  }
  if (input.description !== undefined) {
    patch.description = input.description
    newLocks.add('description')
  }
  if (input.lat !== undefined && input.lon !== undefined) {
    patch.geom = { lat: input.lat, lon: input.lon }
    newLocks.add('geom')
  }
  if (input.arrivalAt !== undefined) {
    patch.arrivalAt = input.arrivalAt ? new Date(input.arrivalAt) : null
    newLocks.add('arrivalAt')
  }
  if (input.departureAt !== undefined) {
    patch.departureAt = input.departureAt ? new Date(input.departureAt) : null
    newLocks.add('departureAt')
  }

  patch.lockedFields = [...newLocks]
  patch.source = 'user_override'
  patch.updatedAt = new Date()

  const [updated] = await db.update(sections).set(patch).where(eq(sections.id, section.id)).returning()

  if (input.arrivalAt !== undefined) {
    await reindexSectionOrder(section.journeyId)
  }
  return updated!
}

export async function deleteSection(sectionId: string, journeyId: string) {
  const db = useDb()
  // photos.sectionId has onDelete: 'set null' — member photos become unsorted, not deleted.
  await db.delete(sections).where(eq(sections.id, sectionId))
  await reindexSectionOrder(journeyId)
}

export async function mergeSections(sourceId: string, targetId: string, journeyId: string) {
  const db = useDb()
  const memberPhotos = await db.select({ id: photos.id, lockedFields: photos.lockedFields }).from(photos).where(eq(photos.sectionId, sourceId))

  for (const photo of memberPhotos) {
    const locks = new Set(photo.lockedFields)
    locks.add('sectionId')
    await db.update(photos).set({ sectionId: targetId, source: 'user_override', lockedFields: [...locks] }).where(eq(photos.id, photo.id))
  }

  await db.delete(sections).where(eq(sections.id, sourceId))
  await reindexSectionOrder(journeyId)
  return { movedPhotos: memberPhotos.length }
}

export async function splitSection(source: typeof sections.$inferSelect, photoIds: string[], title?: string) {
  const db = useDb()

  const moving = await db.select().from(photos).where(eq(photos.sectionId, source.id))
  const movingSet = new Set(photoIds)
  const selected = moving.filter((p) => movingSet.has(p.id))
  if (selected.length === 0) {
    throw new Error('None of the given photoIds belong to this section')
  }

  const timestamps = selected.map((p) => p.capturedAt?.getTime()).filter((t): t is number => t != null)

  // source.geom (from a plain select) is an opaque driver value, not a
  // {lat,lon} our geometryPoint customType can write back out — project it
  // through ST_X/ST_Y explicitly to get real coordinates to copy.
  const [sourceCoords] = await db.select(geoPointSelect(sections.geom)).from(sections).where(eq(sections.id, source.id)).limit(1)

  const [created] = await db
    .insert(sections)
    .values({
      journeyId: source.journeyId,
      title: title ?? source.title,
      placeName: source.placeName,
      description: source.description,
      geom: sourceCoords?.lat != null && sourceCoords?.lon != null ? { lat: sourceCoords.lat, lon: sourceCoords.lon } : null,
      arrivalAt: timestamps.length ? new Date(Math.min(...timestamps)) : source.arrivalAt,
      departureAt: timestamps.length ? new Date(Math.max(...timestamps)) : source.departureAt,
      confidence: 'high',
      source: 'user_override',
      lockedFields: ['title', 'placeName', 'description', 'arrivalAt', 'departureAt']
    })
    .returning()

  for (const photo of selected) {
    const locks = new Set(photo.lockedFields)
    locks.add('sectionId')
    await db.update(photos).set({ sectionId: created!.id, source: 'user_override', lockedFields: [...locks] }).where(eq(photos.id, photo.id))
  }

  await reindexSectionOrder(source.journeyId)
  return created!
}
