import { createSectionSchema } from '../../../../shared/types/sections'
import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createSection } from '../../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const body = await readValidatedBody(event, createSectionSchema.parse)
  const section = await createSection(journeyId, body)
  setResponseStatus(event, 201)
  return section
})
