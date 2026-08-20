import { bulkDeletePhotosSchema } from '../../../../../shared/types/photos'
import { getJourneyForOwner } from '../../../../domain/journeys/journeys'
import { bulkDeletePhotos } from '../../../../domain/photos/photos'
import { clusterJourney } from '../../../../domain/sections/cluster-journey'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const body = await readValidatedBody(event, bulkDeletePhotosSchema.parse)

  const count = await bulkDeletePhotos(journeyId, body.photoIds)

  // Deleting many photos at once can empty out sections or change gap
  // evidence for trace reconstruction — same cleanup as a single delete.
  await clusterJourney(journeyId)

  return { ok: true, count }
})
