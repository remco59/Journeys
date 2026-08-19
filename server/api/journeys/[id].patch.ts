import { updateJourneySchema } from '../../../shared/types/journeys'
import { updateJourney } from '../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, updateJourneySchema.parse)
  const journey = await updateJourney(id, user.id, body)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return journey
})
