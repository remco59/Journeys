import { reorderSectionsSchema } from '../../../../../shared/types/sections'
import { getJourneyForOwner } from '../../../../domain/journeys/journeys'
import { reorderSections } from '../../../../domain/sections/sections'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const body = await readValidatedBody(event, reorderSectionsSchema.parse)
  try {
    await reorderSections(journeyId, body.orderedIds)
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err?.message ?? 'Could not reorder sections' })
  }
  return { ok: true }
})
