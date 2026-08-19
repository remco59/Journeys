import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

let pool: Pool | undefined
let db: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    pool = new Pool({ connectionString })
    db = drizzle(pool, { schema })
  }
  return db
}

export async function checkDbConnection() {
  const database = useDb()
  await database.execute('select 1')
}
