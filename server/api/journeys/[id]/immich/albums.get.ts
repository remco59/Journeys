import { getJourneyForOwner } from '../../../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const client = await requireImmichClient(user.id)
  return client.listAlbums()
})
