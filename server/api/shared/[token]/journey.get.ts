import { getJourneyById } from '../../../domain/journeys/journeys'
import { toPublicJourney } from '../../../domain/sharing/serializers'

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const journey = await getJourneyById(journeyId)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Shared journey not found' })
  }
  return toPublicJourney(journey)
})
