import { getPhotoForOwner, setJourneyCoverPhoto } from '../../../domain/photos/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const photoId = getRouterParam(event, 'id')!

  const photo = await getPhotoForOwner(photoId, user.id)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  await setJourneyCoverPhoto(photo.journeyId, photo.id)
  return { ok: true }
})
