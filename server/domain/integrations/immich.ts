import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'

export async function getImmichCredentials(userId: string): Promise<{ baseUrl: string; apiKey: string } | null> {
  const db = useDb()
  const rows = await db
    .select({ immichBaseUrl: users.immichBaseUrl, immichApiKeyEnc: users.immichApiKeyEnc })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row?.immichBaseUrl || !row.immichApiKeyEnc) return null
  return { baseUrl: row.immichBaseUrl, apiKey: decryptSecret(row.immichApiKeyEnc) }
}

export async function getImmichConnectionStatus(userId: string): Promise<{ connected: boolean; baseUrl: string | null }> {
  const db = useDb()
  const rows = await db.select({ immichBaseUrl: users.immichBaseUrl }).from(users).where(eq(users.id, userId)).limit(1)
  const baseUrl = rows[0]?.immichBaseUrl ?? null
  return { connected: !!baseUrl, baseUrl }
}

export async function setImmichCredentials(userId: string, input: { baseUrl: string; apiKey: string }): Promise<void> {
  const db = useDb()
  await db
    .update(users)
    .set({ immichBaseUrl: input.baseUrl, immichApiKeyEnc: encryptSecret(input.apiKey) })
    .where(eq(users.id, userId))
}

export async function clearImmichCredentials(userId: string): Promise<void> {
  const db = useDb()
  await db.update(users).set({ immichBaseUrl: null, immichApiKeyEnc: null }).where(eq(users.id, userId))
}
