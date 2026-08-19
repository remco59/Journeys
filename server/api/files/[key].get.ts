import { getPhotoByStorageKey } from '../../domain/photos/photos'
import { getJourneyForOwner } from '../../domain/journeys/journeys'
import { getStorage } from '../../storage'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif'
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const key = decodeURIComponent(getRouterParam(event, 'key')!)

  // Every read is re-authorized per request — this is what makes share-link
  // revocation (§19) and per-user isolation actually effective, instead of
  // relying on a stable public URL that could be cached or leaked.
  const photo = await getPhotoByStorageKey(key)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const journey = await getJourneyForOwner(photo.journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const storage = getStorage()
  const data = await storage.get(key)
  const ext = key.slice(key.lastIndexOf('.'))

  setHeader(event, 'content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
  setHeader(event, 'cache-control', 'private, max-age=86400')
  return data
})
