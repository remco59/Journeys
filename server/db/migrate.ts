import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { mkdirSync, mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve('./server/db/migrations')

// Postgres forbids using an enum value added via ALTER TYPE ... ADD VALUE
// within the same transaction that added it, but drizzle's migrator batches
// all pending migration files into a single transaction. On a fresh
// database every migration is pending at once, so a migration that adds an
// enum value and a later one that uses it would land in the same batch and
// fail. Find any such migrations and give them their own commit boundary.
function findEnumValueBoundaries(): string[] {
  const journal = readJournal()
  return journal.entries
    .filter((entry: { tag: string }) => /ADD VALUE/i.test(readFileSync(path.join(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf-8')))
    .map((entry: { tag: string }) => entry.tag)
}

function readJournal() {
  return JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf-8'))
}

function makeFolderUpTo(tag: string): string {
  const journal = readJournal()
  const cutoffIdx = journal.entries.find((entry: { tag: string }) => entry.tag === tag).idx
  const entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= cutoffIdx)

  const dir = mkdtempSync(path.join(tmpdir(), 'migrations-'))
  mkdirSync(path.join(dir, 'meta'))
  for (const entry of entries) {
    cpSync(path.join(MIGRATIONS_DIR, `${entry.tag}.sql`), path.join(dir, `${entry.tag}.sql`))
  }
  writeFileSync(path.join(dir, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries }))
  return dir
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  // PostGIS must exist before any migration references geometry columns.
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis')

  for (const tag of findEnumValueBoundaries()) {
    await migrate(db, { migrationsFolder: makeFolderUpTo(tag) })
  }
  await migrate(db, { migrationsFolder: './server/db/migrations' })

  await pool.end()
  console.log('Migrations applied.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
