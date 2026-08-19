import { createHash } from 'node:crypto'
import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createImport, completeImport, createImportFile, findExistingImportFileByChecksum } from '../../../domain/imports/imports'
import { createPendingPhoto } from '../../../domain/photos/photos'
import { validateImageUpload } from '../../../domain/photos/upload-validation'
import { getStorage } from '../../../storage'
import { enqueueJob } from '../../../jobs/queue'

type UploadResult =
  | { filename: string; status: 'queued'; photoId: string }
  | { filename: string; status: 'duplicate' }
  | { filename: string; status: 'rejected'; reason: string }

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

  const storage = getStorage()
  const importRow = await createImport(journeyId, 'photo_batch', user.id)
  const results: UploadResult[] = []

  for (const part of fileParts) {
    const filename = part.filename!
    try {
      const { mimeType, extension } = await validateImageUpload(part.data)
      const checksum = createHash('sha256').update(part.data).digest('hex')

      const existing = await findExistingImportFileByChecksum(journeyId, checksum)
      if (existing) {
        results.push({ filename, status: 'duplicate' })
        continue
      }

      const storageKey = `${journeyId}/${checksum}/original${extension}`
      await storage.put(storageKey, part.data, { contentType: mimeType })

      const importFile = await createImportFile({
        importId: importRow.id,
        journeyId,
        originalFilename: filename,
        storageKey,
        mimeType,
        sizeBytes: part.data.length,
        checksumSha256: checksum
      })

      const photo = await createPendingPhoto({ journeyId, importFileId: importFile.id, storageKeyOriginal: storageKey })
      await enqueueJob('process-photo', { photoId: photo.id })

      results.push({ filename, status: 'queued', photoId: photo.id })
    } catch (err) {
      results.push({ filename, status: 'rejected', reason: (err as Error).message })
    }
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
