import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getStorage } from '../../storage'
import { getPhotoById, applyExtractedMetadata, maybeSetJourneyCover } from '../../domain/photos/photos'
import { markImportFileStatus } from '../../domain/imports/imports'
import { extractPhotoMetadata } from '../../domain/photos/exif'
import { generateDerivedImages } from '../../domain/photos/images'
import { enqueueJob, type JobPayloads } from '../queue'

// Coalesces bursty uploads: each processed photo re-schedules the same
// pending job a few seconds out (jobKey + runAt), so a batch of 50 photos
// triggers one recluster shortly after the last one finishes, not 50.
const CLUSTER_DEBOUNCE_MS = 10_000

export async function processPhotoTask(payload: JobPayloads['process-photo']): Promise<void> {
  const photo = await getPhotoById(payload.photoId)
  if (!photo) return // deleted before the job ran

  const storage = getStorage()
  const original = await storage.get(photo.storageKeyOriginal)

  const tempPath = path.join(os.tmpdir(), `journeys-${photo.id}${path.extname(photo.storageKeyOriginal)}`)
  await fs.writeFile(tempPath, original)

  try {
    const meta = await extractPhotoMetadata(tempPath)
    const { thumb, preview } = await generateDerivedImages(original)

    const base = photo.storageKeyOriginal.replace(/\/original\.[^/.]+$/, '')
    const storageKeyThumb = `${base}/thumb.webp`
    const storageKeyPreview = `${base}/preview.webp`

    await storage.put(storageKeyThumb, thumb, { contentType: 'image/webp' })
    await storage.put(storageKeyPreview, preview, { contentType: 'image/webp' })

    await applyExtractedMetadata(photo.id, meta, { storageKeyPreview, storageKeyThumb })
    await maybeSetJourneyCover(photo.journeyId, photo.id)

    if (photo.importFileId) {
      await markImportFileStatus(photo.importFileId, 'processed')
    }

    await enqueueJob(
      'cluster-journey',
      { journeyId: photo.journeyId },
      { jobKey: `cluster-journey:${photo.journeyId}`, runAt: new Date(Date.now() + CLUSTER_DEBOUNCE_MS) }
    )
  } catch (err) {
    if (photo.importFileId) {
      await markImportFileStatus(photo.importFileId, 'failed', (err as Error).message)
    }
    throw err
  } finally {
    await fs.rm(tempPath, { force: true })
  }
}
