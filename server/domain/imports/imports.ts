import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { imports, importFiles } from '../../db/schema'

export async function createImport(
  journeyId: string,
  sourceType: (typeof imports.$inferInsert)['sourceType'],
  createdBy: string
) {
  const db = useDb()
  const [row] = await db.insert(imports).values({ journeyId, sourceType, createdBy, status: 'processing' }).returning()
  return row! // a single-row insert always returns exactly one row
}

export async function completeImport(importId: string, stats?: Record<string, unknown>) {
  const db = useDb()
  await db.update(imports).set({ status: 'completed', completedAt: new Date(), stats }).where(eq(imports.id, importId))
}

export async function findExistingImportFileByChecksum(journeyId: string, checksum: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(importFiles)
    .where(and(eq(importFiles.journeyId, journeyId), eq(importFiles.checksumSha256, checksum)))
    .limit(1)
  return rows[0] ?? null
}

export async function createImportFile(input: {
  importId: string
  journeyId: string
  originalFilename: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  checksumSha256: string
}) {
  const db = useDb()
  const [row] = await db.insert(importFiles).values({ ...input, status: 'pending' }).returning()
  return row!
}

export async function markImportFileStatus(id: string, status: (typeof importFiles.$inferInsert)['status'], errorMessage?: string) {
  const db = useDb()
  await db.update(importFiles).set({ status, errorMessage }).where(eq(importFiles.id, id))
}
