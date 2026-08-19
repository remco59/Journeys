import { deleteJourney } from '../../domain/journeys/journeys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')!
  const deleted = await deleteJourney(id, user.id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return { ok: true }
})
