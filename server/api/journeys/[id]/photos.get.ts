import { listPhotosForOwner } from '../../../domain/photos/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  const photos = await listPhotosForOwner(journeyId, user.id)
  if (photos === null) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return photos
})
