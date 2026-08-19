import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { journeyShares, journeys } from '../../db/schema'

export async function createShare(journeyId: string, createdBy: string) {
  const db = useDb()
  const token = nanoid(21)
  const [created] = await db.insert(journeyShares).values({ journeyId, token, createdBy }).returning()
  return created!
}

export async function listSharesForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const owns = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.id, journeyId), eq(journeys.ownerId, ownerId))).limit(1)
  if (!owns[0]) return null
  return db.select().from(journeyShares).where(eq(journeyShares.journeyId, journeyId)).orderBy(journeyShares.createdAt)
}

export async function revokeShare(shareId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ share: journeyShares })
    .from(journeyShares)
    .innerJoin(journeys, eq(journeyShares.journeyId, journeys.id))
    .where(and(eq(journeyShares.id, shareId), eq(journeys.ownerId, ownerId)))
    .limit(1)
  if (!rows[0]) return null

  const [updated] = await db.update(journeyShares).set({ revokedAt: new Date() }).where(eq(journeyShares.id, shareId)).returning()
  return updated!
}

/** Resolves a token to its journey id, or null if the token doesn't exist, was revoked, or expired. */
export async function resolveShareToken(token: string): Promise<{ journeyId: string } | null> {
  const db = useDb()
  const rows = await db
    .select({ journeyId: journeyShares.journeyId, revokedAt: journeyShares.revokedAt, expiresAt: journeyShares.expiresAt })
    .from(journeyShares)
    .where(eq(journeyShares.token, token))
    .limit(1)

  const share = rows[0]
  if (!share) return null
  if (share.revokedAt) return null
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return null
  return { journeyId: share.journeyId }
}
