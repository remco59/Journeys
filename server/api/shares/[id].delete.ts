import { revokeShare } from '../../domain/sharing/shares'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const shareId = getRouterParam(event, 'id')!

  const revoked = await revokeShare(shareId, user.id)
  if (!revoked) {
    throw createError({ statusCode: 404, statusMessage: 'Share not found' })
  }
  return { ok: true }
})
