import { createHash } from 'node:crypto'
import { createImportFile, findExistingImportFileByChecksum } from '../imports/imports'
import { createPendingPhoto } from './photos'
import { validateImageUpload } from './upload-validation'
import { getStorage } from '../../storage'
import { enqueueJob } from '../../jobs/queue'

export type IngestResult =
  | { filename: string; status: 'queued'; photoId: string }
  | { filename: string; status: 'duplicate' }
  | { filename: string; status: 'rejected'; reason: string }

/**
 * The common per-file body shared by every photo entry point (direct
 * upload, Immich import, …): validate → checksum-dedup → store original →
 * record the import file → create a pending photo row → queue processing.
 * Callers own the surrounding `imports` row (createImport/completeImport).
 */
export async function ingestPhotoBuffer(journeyId: string, importId: string, filename: string, data: Buffer): Promise<IngestResult> {
  try {
    const { mimeType, extension } = await validateImageUpload(data)
    const checksum = createHash('sha256').update(data).digest('hex')

    const existing = await findExistingImportFileByChecksum(journeyId, checksum)
    if (existing) {
      return { filename, status: 'duplicate' }
    }

    const storageKey = `${journeyId}/${checksum}/original${extension}`
    await getStorage().put(storageKey, data, { contentType: mimeType })

    const importFile = await createImportFile({
      importId,
      journeyId,
      originalFilename: filename,
      storageKey,
      mimeType,
      sizeBytes: data.length,
      checksumSha256: checksum
    })

    const photo = await createPendingPhoto({ journeyId, importFileId: importFile.id, storageKeyOriginal: storageKey })
    await enqueueJob('process-photo', { photoId: photo.id })

    return { filename, status: 'queued', photoId: photo.id }
  } catch (err) {
    return { filename, status: 'rejected', reason: (err as Error).message }
  }
}
