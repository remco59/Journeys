import { getImmichConnectionStatus } from '../../domain/integrations/immich'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  return getImmichConnectionStatus(user.id)
})
