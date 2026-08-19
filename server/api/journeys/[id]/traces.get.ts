import { listTracesForOwner } from '../../../domain/traces/traces'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  const traces = await listTracesForOwner(journeyId, user.id)
  if (traces === null) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return traces
})
