import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createImport, completeImport } from '../../../domain/imports/imports'
import { ingestPhotoBuffer, type IngestResult } from '../../../domain/photos/ingest'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const parts = await readMultipartFormData(event)
  const fileParts = (parts ?? []).filter((p) => p.filename && p.data && p.data.length > 0)
  if (!fileParts.length) {
    throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
  }

  const importRow = await createImport(journeyId, 'photo_batch', user.id)
  const results: IngestResult[] = []

  for (const part of fileParts) {
    results.push(await ingestPhotoBuffer(journeyId, importRow.id, part.filename!, part.data))
  }

  await completeImport(importRow.id, {
    fileCount: fileParts.length,
    queued: results.filter((r) => r.status === 'queued').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    rejected: results.filter((r) => r.status === 'rejected').length
  })

  setResponseStatus(event, 202)
  return { importId: importRow.id, files: results }
})
