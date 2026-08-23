import { clearImmichCredentials } from '../../domain/integrations/immich'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  await clearImmichCredentials(user.id)
  return { connected: false, baseUrl: null }
})
