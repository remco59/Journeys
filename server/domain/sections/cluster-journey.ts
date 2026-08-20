import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { photos, sections } from '../../db/schema'
import { geoPointSelect } from '../../db/postgis'
import { buildSectionCandidates, type ClusterPoint } from '../clustering/section-candidates'
import { reverseGeocode } from '../../geo/geocode'
import { pickUnlockedFields } from '../provenance/locked-patch'
import { reconstructJourneyTraces } from '../traces/reconstruct-journey'

async function fetchClusterablePhotos(journeyId: string): Promise<ClusterPoint[]> {
  const db = useDb()
  const rows = await db
    .select({
      id: photos.id,
      capturedAt: photos.capturedAt,
      lockedFields: photos.lockedFields,
      ...geoPointSelect(photos.geom)
    })
    .from(photos)
    .where(and(eq(photos.journeyId, journeyId), isNotNull(photos.geom), isNotNull(photos.capturedAt)))

  return rows
    .filter((r) => !r.lockedFields.includes('sectionId') && r.lat != null && r.lon != null && r.capturedAt != null)
    .map((r) => ({ id: r.id, lat: r.lat!, lon: r.lon!, timestamp: r.capturedAt!.getTime() }))
}

/**
 * Photos with no resolvable GPS never produce a cluster point, so they'd
 * otherwise sit unsorted forever. Once every geotagged photo has settled
 * into a section (this runs after that loop), a location-less photo whose
 * capture time falls inside one section's [arrivalAt, departureAt] span —
 * i.e. it was taken between that section's own photos — is placed there
 * too. A photo matching no section's time span, or matching more than one
 * (ambiguous), is left unsorted rather than guessed at.
 */
async function assignUnlocatedPhotosByTime(journeyId: string): Promise<number> {
  const db = useDb()
  const orphans = await db
    .select({ id: photos.id, capturedAt: photos.capturedAt, lockedFields: photos.lockedFields })
    .from(photos)
    .where(and(eq(photos.journeyId, journeyId), isNull(photos.geom), isNull(photos.sectionId), isNotNull(photos.capturedAt)))
  const candidates = orphans.filter((p) => !p.lockedFields.includes('sectionId'))
  if (candidates.length === 0) return 0

  const currentSections = await db
    .select({ id: sections.id, arrivalAt: sections.arrivalAt, departureAt: sections.departureAt })
    .from(sections)
    .where(eq(sections.journeyId, journeyId))
  const timedSections = currentSections.filter((s) => s.arrivalAt != null && s.departureAt != null) as Array<{
    id: string
    arrivalAt: Date
    departureAt: Date
  }>

  let photosAssigned = 0
  for (const photo of candidates) {
    const capturedMs = photo.capturedAt!.getTime()
    const matches = timedSections.filter((s) => capturedMs >= s.arrivalAt.getTime() && capturedMs <= s.departureAt.getTime())
    if (matches.length !== 1) continue // no fit, or ambiguous overlap — leave unsorted
    await db.update(photos).set({ sectionId: matches[0]!.id }).where(eq(photos.id, photo.id))
    photosAssigned++
  }
  return photosAssigned
}

async function deleteEmptyAutoSections(journeyId: string): Promise<void> {
  const db = useDb()
  const candidates = await db
    .select({ id: sections.id, lockedFields: sections.lockedFields })
    .from(sections)
    .where(and(eq(sections.journeyId, journeyId), eq(sections.source, 'auto')))

  for (const candidate of candidates) {
    if (candidate.lockedFields.length > 0) continue
    const members = await db.select({ id: photos.id }).from(photos).where(eq(photos.sectionId, candidate.id)).limit(1)
    if (members.length === 0) {
      await db.delete(sections).where(eq(sections.id, candidate.id))
    }
  }
}

export type ClusterJourneyResult = {
  sectionsCreated: number
  sectionsUpdated: number
  photosAssigned: number
  tracesCreated: number
  tracesUpdated: number
}

/**
 * Recomputes sections from the journey's current geotagged photos. Safe to
 * call repeatedly (uploads trigger it debounced, per journey): existing
 * sections are matched by photo-membership overlap and only their unlocked
 * fields are touched; a candidate with no matching existing section becomes
 * a new auto section; an auto section left with no members is removed.
 * See architecture plan §09 and §12.
 */
export async function clusterJourney(journeyId: string): Promise<ClusterJourneyResult> {
  const db = useDb()
  const points = await fetchClusterablePhotos(journeyId)

  const existingSections = await db.select().from(sections).where(eq(sections.journeyId, journeyId))
  const existingMembership = new Map<string, Set<string>>()
  for (const section of existingSections) {
    const memberRows = await db.select({ id: photos.id }).from(photos).where(eq(photos.sectionId, section.id))
    existingMembership.set(section.id, new Set(memberRows.map((r) => r.id)))
  }

  const candidates = points.length
    ? await buildSectionCandidates(points, async (p) => {
        const place = await reverseGeocode(p.lat, p.lon)
        return place ? { name: place.name, locality: place.locality, district: place.district } : null
      })
    : []

  let sectionsCreated = 0
  let sectionsUpdated = 0
  let photosAssigned = 0
  const claimedSectionIds = new Set<string>()

  for (const candidate of candidates) {
    const candidateIds = new Set(candidate.memberIds)

    let bestMatch: { id: string; overlap: number } | null = null
    for (const section of existingSections) {
      if (claimedSectionIds.has(section.id)) continue
      const members = existingMembership.get(section.id) ?? new Set<string>()
      if (members.size === 0) continue
      const overlap = [...candidateIds].filter((id) => members.has(id)).length
      if (overlap === 0) continue
      const ratio = overlap / Math.max(candidateIds.size, members.size)
      if (ratio > 0.5 && (!bestMatch || overlap > bestMatch.overlap)) {
        bestMatch = { id: section.id, overlap }
      }
    }

    let sectionId: string
    if (bestMatch) {
      sectionId = bestMatch.id
      claimedSectionIds.add(sectionId)
      const existing = existingSections.find((s) => s.id === sectionId)!

      const proposedArrival = new Date(candidate.arrivalAt)
      const proposedDeparture = new Date(candidate.departureAt)

      // Compare only the fields we can read back (geom is write-only via
      // our PostGIS customType, see postgis.ts) — on an unchanged input set
      // this is enough to detect "nothing actually changed" and skip the
      // write entirely, rather than reporting an update every rerun.
      const changed =
        existing.title !== candidate.placeName ||
        existing.placeName !== candidate.placeName ||
        existing.confidence !== candidate.confidence ||
        existing.arrivalAt?.getTime() !== proposedArrival.getTime() ||
        existing.departureAt?.getTime() !== proposedDeparture.getTime()

      if (changed) {
        const proposed = {
          title: candidate.placeName,
          placeName: candidate.placeName,
          geom: candidate.centroid,
          arrivalAt: proposedArrival,
          departureAt: proposedDeparture,
          confidence: candidate.confidence
        }
        const patch = pickUnlockedFields(proposed, existing.lockedFields)
        if (Object.keys(patch).length > 0) {
          await db.update(sections).set({ ...patch, updatedAt: new Date() }).where(eq(sections.id, sectionId))
          sectionsUpdated++
        }
      }
    } else {
      const [created] = await db
        .insert(sections)
        .values({
          journeyId,
          title: candidate.placeName,
          placeName: candidate.placeName,
          geom: candidate.centroid,
          arrivalAt: new Date(candidate.arrivalAt),
          departureAt: new Date(candidate.departureAt),
          confidence: candidate.confidence,
          source: 'auto'
        })
        .returning()
      sectionId = created!.id
      claimedSectionIds.add(sectionId)
      sectionsCreated++
    }

    const alreadyMembers = bestMatch ? existingMembership.get(sectionId) ?? new Set<string>() : new Set<string>()
    for (const photoId of candidate.memberIds) {
      if (alreadyMembers.has(photoId)) continue
      await db.update(photos).set({ sectionId }).where(eq(photos.id, photoId))
      photosAssigned++
    }
  }

  // Runs last, once every geotagged photo has a settled section — an
  // undated-location photo can then be matched against real section spans.
  photosAssigned += await assignUnlocatedPhotosByTime(journeyId)

  await deleteEmptyAutoSections(journeyId)

  // Sections must settle before the traces between them mean anything.
  const traceResult = await reconstructJourneyTraces(journeyId)

  return { sectionsCreated, sectionsUpdated, photosAssigned, ...traceResult }
}
