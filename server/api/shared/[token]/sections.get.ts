import { listSectionsForJourney } from '../../../domain/sections/sections'
import { toPublicSection } from '../../../domain/sharing/serializers'

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const sections = await listSectionsForJourney(journeyId)
  return sections.map(toPublicSection)
})
