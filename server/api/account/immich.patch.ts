import { updateImmichSettingsSchema } from '../../../shared/types/auth'
import { setImmichCredentials } from '../../domain/integrations/immich'
import { ImmichClient } from '../../immich/client'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readValidatedBody(event, updateImmichSettingsSchema.parse)
  const baseUrl = body.baseUrl.replace(/\/+$/, '')

  const client = new ImmichClient(baseUrl, body.apiKey)
  const reachable = await client.ping()
  if (!reachable) {
    throw createError({ statusCode: 400, statusMessage: 'Could not reach Immich with that URL and API key' })
  }

  await setImmichCredentials(user.id, { baseUrl, apiKey: body.apiKey })
  return { connected: true, baseUrl }
})
