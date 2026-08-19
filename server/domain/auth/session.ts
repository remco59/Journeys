import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sessions, users } from '../../db/schema'

export type SessionUser = {
  id: string
  username: string
  role: 'admin' | 'user'
}

export async function createSession(userId: string, ttlDays: number): Promise<{ id: string; expiresAt: Date }> {
  const db = useDb()
  const id = nanoid(48)
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({ id, userId, expiresAt })
  return { id, expiresAt }
}

export async function resolveSession(sessionId: string): Promise<SessionUser | null> {
  const db = useDb()
  const rows = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      role: users.role
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.sessionExpiresAt.getTime() <= Date.now()) {
    await revokeSession(sessionId)
    return null
  }
  return { id: row.userId, username: row.username, role: row.role }
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = useDb()
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}
