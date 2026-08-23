import { getImmichCredentials } from '../domain/integrations/immich'
import { ImmichClient } from '../immich/client'

export async function requireImmichClient(userId: string): Promise<ImmichClient> {
  const credentials = await getImmichCredentials(userId)
  if (!credentials) {
    throw createError({ statusCode: 400, statusMessage: 'Immich is not connected — add your Immich URL and API key in Settings' })
  }
  return new ImmichClient(credentials.baseUrl, credentials.apiKey)
}
