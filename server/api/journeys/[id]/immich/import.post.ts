import { getJourneyForOwner } from '../../../../domain/journeys/journeys'
import { createImport, completeImport } from '../../../../domain/imports/imports'
import { ingestPhotoBuffer, type IngestResult } from '../../../../domain/photos/ingest'
import { importImmichAssetsSchema } from '../../../../../shared/types/photos'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const body = await readValidatedBody(event, importImmichAssetsSchema.parse)
  const client = await requireImmichClient(user.id)

  const importRow = await createImport(journeyId, 'immich', user.id)
  const results: IngestResult[] = []

  for (const asset of body.assets) {
    try {
      const data = await client.downloadOriginal(asset.assetId)
      results.push(await ingestPhotoBuffer(journeyId, importRow.id, asset.filename, data))
    } catch (err) {
      results.push({ filename: asset.filename, status: 'rejected', reason: (err as Error).message })
    }
  }

  await completeImport(importRow.id, {
    fileCount: body.assets.length,
    queued: results.filter((r) => r.status === 'queued').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    rejected: results.filter((r) => r.status === 'rejected').length
  })

  setResponseStatus(event, 202)
  return { importId: importRow.id, files: results }
})
