import { listActivitiesForJourney } from '../../../domain/activities/activities'
import { toPublicActivity } from '../../../domain/sharing/serializers'

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const activities = await listActivitiesForJourney(journeyId)
  return activities.map(toPublicActivity)
})
