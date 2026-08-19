import { listSharesForOwner } from '../../../domain/sharing/shares'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!
  const shares = await listSharesForOwner(journeyId, user.id)
  if (shares === null) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }
  return shares
})
