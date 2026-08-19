import { getPhotoByPublicStorageKey } from '../../../../domain/photos/photos'
import { getStorage } from '../../../../storage'

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp'
}

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const key = decodeURIComponent(getRouterParam(event, 'key')!)

  // Re-checked on every request, exactly like the authenticated files route
  // (§17/§19) — this is what makes revoking a share link actually take
  // effect immediately, and never matches an original's storage key (§22).
  const photo = await getPhotoByPublicStorageKey(key)
  if (!photo || photo.journeyId !== journeyId) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const storage = getStorage()
  const data = await storage.get(key)
  const ext = key.slice(key.lastIndexOf('.'))

  setHeader(event, 'content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
  setHeader(event, 'cache-control', 'private, max-age=86400')
  return data
})
