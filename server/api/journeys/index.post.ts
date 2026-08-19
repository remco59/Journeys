import { createJourneySchema } from '../../../shared/types/journeys'
import { createJourney } from '../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readValidatedBody(event, createJourneySchema.parse)
  const journey = await createJourney(user.id, body)
  setResponseStatus(event, 201)
  return journey
})
