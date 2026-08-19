import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { sections, journeys } from '../../db/schema'

export async function listSectionsForJourney(journeyId: string) {
  const db = useDb()
  return db.select().from(sections).where(eq(sections.journeyId, journeyId)).orderBy(sections.orderIndex)
}

export async function listSectionsForOwner(journeyId: string, ownerId: string) {
  const db = useDb()
  const rows = await db
    .select({ section: sections })
    .from(sections)
    .innerJoin(journeys, eq(sections.journeyId, journeys.id))
    .where(and(eq(sections.journeyId, journeyId), eq(journeys.ownerId, ownerId)))
    .orderBy(sections.orderIndex)
  return rows.map((r) => r.section)
}
