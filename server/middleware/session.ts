import { resolveSession } from '../domain/auth/session'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sessionId = getCookie(event, config.sessionCookieName)
  if (!sessionId) {
    event.context.user = null
    return
  }
  event.context.user = await resolveSession(sessionId)
})
