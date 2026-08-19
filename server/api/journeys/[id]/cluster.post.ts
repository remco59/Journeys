import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { clusterJourney } from '../../../domain/sections/cluster-journey'

/**
 * Runs section clustering synchronously and returns the result. The upload
 * pipeline also triggers this in the background (debounced, §16); this
 * route exists so a user (or a test) can force an immediate recompute
 * instead of waiting out the debounce window.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  return clusterJourney(journeyId)
})
