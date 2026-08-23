import { getJourneyForOwner } from '../../../../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  const assetId = getRouterParam(event, 'assetId')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  // Proxied so the Immich API key never reaches the browser — the picker's
  // <img> tags hit this route, not Immich directly.
  const client = await requireImmichClient(user.id)
  const { data, contentType } = await client.getThumbnail(assetId)

  setHeader(event, 'content-type', contentType)
  setHeader(event, 'cache-control', 'private, max-age=3600')
  return data
})
