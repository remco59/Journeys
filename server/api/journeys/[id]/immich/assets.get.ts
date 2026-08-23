import { getJourneyForOwner } from '../../../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const query = getQuery(event)
  const albumId = typeof query.albumId === 'string' ? query.albumId : null
  const from = typeof query.from === 'string' ? query.from : null
  const to = typeof query.to === 'string' ? query.to : null

  if (!albumId && !(from && to)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide either albumId or from/to' })
  }

  const client = await requireImmichClient(user.id)
  const assets = albumId ? await client.getAlbumAssets(albumId) : await client.searchByDateRange(from!, to!)

  return assets.map((asset) => ({
    id: asset.id,
    filename: asset.originalFileName,
    takenAt: asset.fileCreatedAt,
    thumbnailUrl: `/api/journeys/${journeyId}/immich/thumbnail/${asset.id}`
  }))
})
