import type { H3Event } from 'h3'
import { resolveShareToken } from '../domain/sharing/shares'

/** Resolves the :token route param to a journey id, or throws a 404 — same response whether the token never existed, was revoked, or expired. */
export async function requireShareJourneyId(event: H3Event): Promise<string> {
  const token = getRouterParam(event, 'token')!
  const resolved = await resolveShareToken(token)
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: 'Shared journey not found' })
  }
  return resolved.journeyId
}
