import { listTracesForJourney } from '../../../domain/traces/traces'
import { toPublicTrace } from '../../../domain/sharing/serializers'

export default defineEventHandler(async (event) => {
  const journeyId = await requireShareJourneyId(event)
  const traces = await listTracesForJourney(journeyId)
  return traces.map(toPublicTrace)
})
