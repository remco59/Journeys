import { bulkMovePhotosSchema } from '../../../../../shared/types/photos'
import { getJourneyForOwner } from '../../../../domain/journeys/journeys'
import { getSectionForOwner } from '../../../../domain/sections/sections'
import { bulkMovePhotosToSection } from '../../../../domain/photos/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const body = await readValidatedBody(event, bulkMovePhotosSchema.parse)

  if (body.sectionId) {
    const targetSection = await getSectionForOwner(body.sectionId, user.id)
    if (!targetSection || targetSection.journeyId !== journeyId) {
      throw createError({ statusCode: 400, statusMessage: 'Target section not found in this journey' })
    }
  }

  const count = await bulkMovePhotosToSection(journeyId, body.photoIds, body.sectionId)
  return { ok: true, count }
})
