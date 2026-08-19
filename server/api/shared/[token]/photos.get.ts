import { listPhotosForJourney } from '../../../domain/photos/photos'
import { toPublicPhoto } from '../../../domain/sharing/serializers'

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const photos = await listPhotosForJourney(journeyId)
  return photos.map(toPublicPhoto)
})
