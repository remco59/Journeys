import { getPhotoForOwner, deletePhoto } from '../../domain/photos/photos'
import { clusterJourney } from '../../domain/sections/cluster-journey'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const photoId = getRouterParam(event, 'id')!

  const photo = await getPhotoForOwner(photoId, user.id)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const journeyId = photo.journeyId
  await deletePhoto(photo)

  // A deleted photo can leave its section empty (cleaned up automatically)
  // or change a gap's evidence for trace reconstruction.
  await clusterJourney(journeyId)

  return { ok: true }
})
