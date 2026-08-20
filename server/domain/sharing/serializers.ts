import type { sections, photos, activities, traces } from '../../db/schema'

/**
 * Shaped separately from the owner-facing API responses (§19) — it should
 * be structurally impossible for an edit-only field, another user's data,
 * or an internal identifier to leak into a shared payload just because a
 * domain function's default shape happened to include it.
 */

type SectionRow = typeof sections.$inferSelect
type PhotoRow = typeof photos.$inferSelect
type ActivityRow = typeof activities.$inferSelect
type TraceRow = typeof traces.$inferSelect

export function toPublicJourney(journey: {
  title: string
  description: string | null
  startDate: string
  endDate: string
  coverPhotoId: string | null
}) {
  return {
    title: journey.title,
    description: journey.description,
    startDate: journey.startDate,
    endDate: journey.endDate,
    coverPhotoId: journey.coverPhotoId
  }
}

export function toPublicSection(section: Pick<SectionRow, 'id' | 'title' | 'placeName' | 'description' | 'arrivalAt' | 'departureAt' | 'orderIndex' | 'confidence'> & { lat?: number | null; lon?: number | null }) {
  return {
    id: section.id,
    title: section.title,
    placeName: section.placeName,
    description: section.description,
    arrivalAt: section.arrivalAt,
    departureAt: section.departureAt,
    orderIndex: section.orderIndex,
    confidence: section.confidence,
    lat: section.lat ?? null,
    lon: section.lon ?? null
  }
}

export function toPublicPhoto(
  photo: Pick<PhotoRow, 'id' | 'sectionId' | 'storageKeyThumb' | 'storageKeyPreview' | 'capturedAt' | 'caption' | 'locationSource'>
) {
  return {
    id: photo.id,
    sectionId: photo.sectionId,
    storageKeyThumb: photo.storageKeyThumb,
    storageKeyPreview: photo.storageKeyPreview,
    capturedAt: photo.capturedAt,
    caption: photo.caption,
    locationSource: photo.locationSource
    // Deliberately omitted: exif, cameraMake/Model, lockedFields, source,
    // importFileId, storageKeyOriginal — device/provenance detail with no
    // public-viewer purpose. Originals are also simply never served to
    // shared visitors — only the thumb/preview keys above.
  }
}

export function toPublicActivity(
  activity: Pick<
    ActivityRow,
    'id' | 'sectionId' | 'title' | 'type' | 'startedAt' | 'endedAt' | 'distanceM' | 'elevationGainM' | 'elevationLossM'
  > & { geom: unknown }
) {
  return {
    id: activity.id,
    sectionId: activity.sectionId,
    title: activity.title,
    type: activity.type,
    startedAt: activity.startedAt,
    endedAt: activity.endedAt,
    distanceM: activity.distanceM,
    elevationGainM: activity.elevationGainM,
    elevationLossM: activity.elevationLossM,
    geom: activity.geom
  }
}

export function toPublicTrace(
  trace: Pick<
    TraceRow,
    | 'id'
    | 'fromSectionId'
    | 'toSectionId'
    | 'type'
    | 'transportMode'
    | 'transportModeReason'
    | 'confidence'
    | 'distanceM'
    | 'startedAt'
    | 'endedAt'
  > & {
    geom: unknown
  }
) {
  return {
    id: trace.id,
    fromSectionId: trace.fromSectionId,
    toSectionId: trace.toSectionId,
    type: trace.type,
    transportMode: trace.transportMode,
    transportModeReason: trace.transportModeReason,
    confidence: trace.confidence,
    distanceM: trace.distanceM,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    geom: trace.geom
  }
}
