import { listActivitiesForOwner } from '../../../domain/activities/activities'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  const activities = await listActivitiesForOwner(journeyId, user.id)
  if (activities === null) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return activities
})
