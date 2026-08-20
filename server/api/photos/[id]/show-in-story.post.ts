import { setPhotoShowInStorySchema } from '../../../../shared/types/photos'
import { getPhotoForOwner, setPhotoShowInStory } from '../../../domain/photos/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const photoId = getRouterParam(event, 'id')!

  const photo = await getPhotoForOwner(photoId, user.id)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const body = await readValidatedBody(event, setPhotoShowInStorySchema.parse)
  await setPhotoShowInStory(photoId, body.show)
  return { ok: true }
})
