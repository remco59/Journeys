import { updatePhotoSchema } from '../../../shared/types/photos'
import { getPhotoForOwner, updatePhotoWithLocks } from '../../domain/photos/photos'
import { getSectionForOwner } from '../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const photoId = getRouterParam(event, 'id')!

  const photo = await getPhotoForOwner(photoId, user.id)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const body = await readValidatedBody(event, updatePhotoSchema.parse)

  if (body.sectionId) {
    const targetSection = await getSectionForOwner(body.sectionId, user.id)
    if (!targetSection || targetSection.journeyId !== photo.journeyId) {
      throw createError({ statusCode: 400, statusMessage: 'Target section not found in this journey' })
    }
  }

  return updatePhotoWithLocks(photo, body)
})
