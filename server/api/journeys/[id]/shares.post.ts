import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createShare } from '../../../domain/sharing/shares'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const share = await createShare(journeyId, user.id)
  setResponseStatus(event, 201)
  return { id: share.id, token: share.token, createdAt: share.createdAt, revokedAt: share.revokedAt }
})
