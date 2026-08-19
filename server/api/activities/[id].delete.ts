import { getActivityForOwner, deleteActivityById } from '../../domain/activities/activities'
import { clusterJourney } from '../../domain/sections/cluster-journey'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const activityId = getRouterParam(event, 'id')!

  const activity = await getActivityForOwner(activityId, user.id)
  if (!activity) {
    throw createError({ statusCode: 404, statusMessage: 'Activity not found' })
  }

  const journeyId = activity.journeyId
  await deleteActivityById(activityId)

  // Any trace anchored to this activity is cascade-deleted with it — the
  // gap it covered needs a replacement trace reconstructed.
  await clusterJourney(journeyId)

  return { ok: true }
})
