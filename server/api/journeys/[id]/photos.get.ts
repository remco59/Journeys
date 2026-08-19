import { listPhotosForOwner } from '../../../domain/photos/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  return listPhotosForOwner(journeyId, user.id)
})
