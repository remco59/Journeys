import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { journeys } from '../../db/schema'
import type { CreateJourneyInput, UpdateJourneyInput } from '../../../shared/types/journeys'

export async function listJourneysForOwner(ownerId: string) {
  const db = useDb()
  return db
    .select()
    .from(journeys)
    .where(eq(journeys.ownerId, ownerId))
    .orderBy(journeys.startDate)
}

export async function getJourneyForOwner(id: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createJourney(ownerId: string, input: CreateJourneyInput) {
  const db = useDb()
  const [row] = await db
    .insert(journeys)
    .values({
      ownerId,
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate,
      endDate: input.endDate
    })
    .returning()
  return row
}

export async function updateJourney(id: string, ownerId: string, input: UpdateJourneyInput) {
  const db = useDb()
  const [row] = await db
    .update(journeys)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .returning()
  return row ?? null
}

export async function deleteJourney(id: string, ownerId: string) {
  const db = useDb()
  const [row] = await db
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.ownerId, ownerId)))
    .returning({ id: journeys.id })
  return row ?? null
}
