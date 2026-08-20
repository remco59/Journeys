import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { hashPassword } from './password'
import type { CreateUserInput, UpdateSettingsInput } from '../../../shared/types/auth'

export async function findUserByUsername(username: string) {
  const db = useDb()
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
  return rows[0] ?? null
}

export async function findUserById(id: string) {
  const db = useDb()
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function countUsers(): Promise<number> {
  const db = useDb()
  const rows = await db.select({ id: users.id }).from(users)
  return rows.length
}

export async function listUsers() {
  const db = useDb()
  return db
    .select({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(users.createdAt)
}

export async function createUser(input: CreateUserInput) {
  const db = useDb()
  const passwordHash = await hashPassword(input.password)
  const [row] = await db
    .insert(users)
    .values({ username: input.username, passwordHash, role: input.role })
    .returning({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt })
  return row! // a single-row insert always returns exactly one row
}

export async function updateUserSettings(userId: string, input: UpdateSettingsInput) {
  const db = useDb()
  const [row] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, userId))
    .returning({ theme: users.theme, distanceUnit: users.distanceUnit })
  return row! // updating by primary key of an existing session's user always returns exactly one row
}

export async function updateUsername(userId: string, username: string) {
  const db = useDb()
  const [row] = await db
    .update(users)
    .set({ username })
    .where(eq(users.id, userId))
    .returning({ id: users.id, username: users.username })
  return row!
}

export async function updateUserPassword(userId: string, newPasswordHash: string) {
  const db = useDb()
  await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId))
}
