import { updateActivitySchema } from '../../../shared/types/activities'
import { getActivityForOwner, updateActivityWithLocks } from '../../domain/activities/activities'
import { getSectionForOwner } from '../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const activityId = getRouterParam(event, 'id')!

  const activity = await getActivityForOwner(activityId, user.id)
  if (!activity) {
    throw createError({ statusCode: 404, statusMessage: 'Activity not found' })
  }

  const body = await readValidatedBody(event, updateActivitySchema.parse)

  if (body.sectionId) {
    const targetSection = await getSectionForOwner(body.sectionId, user.id)
    if (!targetSection || targetSection.journeyId !== activity.journeyId) {
      throw createError({ statusCode: 400, statusMessage: 'Target section not found in this journey' })
    }
  }

  return updateActivityWithLocks(activity, body)
})
