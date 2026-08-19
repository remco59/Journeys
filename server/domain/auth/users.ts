import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { hashPassword } from './password'
import type { CreateUserInput } from '../../../shared/types/auth'

export async function findUserByUsername(username: string) {
  const db = useDb()
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
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
  return row
}
