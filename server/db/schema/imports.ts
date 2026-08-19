import { pgTable, pgEnum, uuid, varchar, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core'
import { journeys } from './journeys'
import { users } from './users'

export const importSourceTypeEnum = pgEnum('import_source_type', [
  'photo_batch',
  'google_timeline',
  'gpx',
  'tcx',
  'fit'
])

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'superseded'
])

export const importFileStatusEnum = pgEnum('import_file_status', ['pending', 'processing', 'processed', 'failed'])

export const imports = pgTable(
  'imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    sourceType: importSourceTypeEnum('source_type').notNull(),
    status: importStatusEnum('status').notNull().default('pending'),
    parserName: varchar('parser_name', { length: 100 }),
    parserVersion: varchar('parser_version', { length: 20 }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    stats: jsonb('stats').$type<Record<string, unknown>>()
  },
  (table) => [index('imports_journey_id_idx').on(table.journeyId)]
)

export const importFiles = pgTable(
  'import_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id').notNull().references(() => imports.id, { onDelete: 'cascade' }),
    journeyId: uuid('journey_id').notNull().references(() => journeys.id, { onDelete: 'cascade' }),
    originalFilename: varchar('original_filename', { length: 500 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    status: importFileStatusEnum('status').notNull().default('pending'),
    errorMessage: varchar('error_message', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('import_files_import_id_idx').on(table.importId),
    unique('import_files_journey_checksum_unique').on(table.journeyId, table.checksumSha256)
  ]
)
