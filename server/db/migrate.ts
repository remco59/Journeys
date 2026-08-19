import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const pool = new Pool({ connectionString })

  // PostGIS must exist before any migration references geometry columns.
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis')

  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './server/db/migrations' })

  await pool.end()
  console.log('Migrations applied.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
