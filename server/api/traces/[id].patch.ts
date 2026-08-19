import { updateTraceSchema } from '../../../shared/types/traces'
import { getTraceForOwner, updateTraceTransportMode } from '../../domain/traces/traces'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const traceId = getRouterParam(event, 'id')!

  const trace = await getTraceForOwner(traceId, user.id)
  if (!trace) {
    throw createError({ statusCode: 404, statusMessage: 'Trace not found' })
  }

  const body = await readValidatedBody(event, updateTraceSchema.parse)
  return updateTraceTransportMode(trace, body.transportMode)
})
