import { revokeSession } from '../../domain/auth/session'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sessionId = getCookie(event, config.sessionCookieName)
  if (sessionId) {
    await revokeSession(sessionId)
  }
  deleteCookie(event, config.sessionCookieName, { path: '/' })
  return { ok: true }
})
