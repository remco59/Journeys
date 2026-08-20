import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, journeys, photos } from '../../db/schema'
import { geoPointSelect } from '../../db/postgis'
import type { CreateSectionInput, UpdateSectionInput } from '../../../shared/types/sections'

/** Includes lat/lon (projected out of the otherwise write-only geom column) — the Map view needs real coordinates. */
export async function listSectionsForJourney(journeyId: string) {
  const db = useDb()
  const rows = await db
    .select({ section: sections, ...geoPointSelect(sections.geom) })
    .from(sections)
    .where(eq(sections.journeyId, journeyId))
    .orderBy(sections.arrivalAt)
  return rows.map((r) => ({ ...r.section, lat: r.lat, lon: r.lon }))
}

export async function listSectionsForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const owns = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.id, journeyId), eq(journeys.ownerId, ownerId))).limit(1)
  if (!owns[0]) return null
  return listSectionsForJourney(journeyId)
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

/** Derives a section's arrival/departure/location from a set of photos — min/max capture time, centroid of their points. Shared by createSection's photo-seeded path and splitSection. */
async function deriveFromPhotos(photoRows: Array<{ capturedAt: Date | null; lat?: number | null; lon?: number | null }>) {
  const timestamps = photoRows.map((p) => p.capturedAt?.getTime()).filter((t): t is number => t != null)
  const points = photoRows.filter((p): p is { capturedAt: Date | null; lat: number; lon: number } => p.lat != null && p.lon != null)
  return {
    arrivalAt: timestamps.length ? new Date(Math.min(...timestamps)) : null,
    departureAt: timestamps.length ? new Date(Math.max(...timestamps)) : null,
    geom: points.length
      ? { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lon: points.reduce((s, p) => s + p.lon, 0) / points.length }
      : null
  }
}

/** Every field the caller actually supplied becomes both the new value AND a locked field. */
export async function createSection(journeyId: string, input: CreateSectionInput) {
  const db = useDb()

  if (input.photoIds?.length) {
    const candidates = await db
      .select({ id: photos.id, capturedAt: photos.capturedAt, sectionId: photos.sectionId, lockedFields: photos.lockedFields, ...geoPointSelect(photos.geom) })
      .from(photos)
      .where(eq(photos.journeyId, journeyId))
    const selected = candidates.filter((p) => input.photoIds!.includes(p.id) && p.sectionId === null)
    if (selected.length === 0) {
      throw new Error('None of the given photoIds are unsorted photos in this journey')
    }
    const derived = await deriveFromPhotos(selected)

    const [created] = await db
      .insert(sections)
      .values({
        journeyId,
        title: input.title,
        placeName: input.placeName ?? null,
        description: input.description ?? null,
        geom: derived.geom,
        arrivalAt: derived.arrivalAt!,
        departureAt: derived.departureAt,
        confidence: 'high',
        source: 'user_override',
        lockedFields: ['title', 'placeName', 'description', 'arrivalAt', 'departureAt', 'geom']
      })
      .returning()

    for (const photo of selected) {
      const locks = new Set(photo.lockedFields)
      locks.add('sectionId')
      await db.update(photos).set({ sectionId: created!.id, source: 'user_override', lockedFields: [...locks] }).where(eq(photos.id, photo.id))
    }
    return created!
  }

  const lockedFields: string[] = ['title']
  if (input.placeName !== undefined) lockedFields.push('placeName')
  if (input.description !== undefined) lockedFields.push('description')
  if (input.lat !== undefined && input.lon !== undefined) lockedFields.push('geom')
  lockedFields.push('arrivalAt')
  if (input.departureAt !== undefined) lockedFields.push('departureAt')

  const [created] = await db
    .insert(sections)
    .values({
      journeyId,
      title: input.title,
      placeName: input.placeName ?? null,
      description: input.description ?? null,
      geom: input.lat !== undefined && input.lon !== undefined ? { lat: input.lat, lon: input.lon } : null,
      arrivalAt: new Date(input.arrivalAt!),
      departureAt: input.departureAt ? new Date(input.departureAt) : null,
      confidence: 'high',
      source: 'user_override',
      lockedFields
    })
    .returning()

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
    patch.arrivalAt = new Date(input.arrivalAt)
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
  return updated!
}

/**
 * Manual drag-reorder from the editor. Ordering has one source of truth
 * (arrivalAt), so "reorder" means reassigning the journey's existing
 * (arrivalAt, departureAt) pairs — sorted ascending — to the requested
 * section order, one pair per position. Real timestamps stay real, just
 * relabeled, and the result sorts back into exactly the requested order.
 */
export async function reorderSections(journeyId: string, orderedIds: string[]) {
  const db = useDb()
  const existing = await db
    .select({ id: sections.id, arrivalAt: sections.arrivalAt, departureAt: sections.departureAt, lockedFields: sections.lockedFields })
    .from(sections)
    .where(eq(sections.journeyId, journeyId))
    .orderBy(sections.arrivalAt)
  const existingIds = new Set(existing.map((s) => s.id))
  if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
    throw new Error('orderedIds must be exactly the set of section ids in this journey')
  }
  const byId = new Map(existing.map((s) => [s.id, s]))
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!
    const slot = existing[i]!
    const locks = new Set(byId.get(id)!.lockedFields)
    locks.add('arrivalAt')
    locks.add('departureAt')
    await db.update(sections).set({ arrivalAt: slot.arrivalAt, departureAt: slot.departureAt, source: 'user_override', lockedFields: [...locks] }).where(eq(sections.id, id))
  }
}

export async function deleteSection(sectionId: string) {
  const db = useDb()
  // photos.sectionId has onDelete: 'set null' — member photos become unsorted, not deleted.
  await db.delete(sections).where(eq(sections.id, sectionId))
}

export async function mergeSections(sourceId: string, targetId: string) {
  const db = useDb()
  const memberPhotos = await db.select({ id: photos.id, lockedFields: photos.lockedFields }).from(photos).where(eq(photos.sectionId, sourceId))

  for (const photo of memberPhotos) {
    const locks = new Set(photo.lockedFields)
    locks.add('sectionId')
    await db.update(photos).set({ sectionId: targetId, source: 'user_override', lockedFields: [...locks] }).where(eq(photos.id, photo.id))
  }

  await db.delete(sections).where(eq(sections.id, sourceId))
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

  return created!
}
