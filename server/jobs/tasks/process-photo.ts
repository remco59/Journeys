import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getStorage } from '../../storage'
import { getPhotoById, applyExtractedMetadata, maybeSetJourneyCover } from '../../domain/photos/photos'
import { markImportFileStatus } from '../../domain/imports/imports'
import { extractPhotoMetadata } from '../../domain/photos/exif'
import { generateDerivedImages } from '../../domain/photos/images'
import type { JobPayloads } from '../queue'

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
  } catch (err) {
    if (photo.importFileId) {
      await markImportFileStatus(photo.importFileId, 'failed', (err as Error).message)
    }
    throw err
  } finally {
    await fs.rm(tempPath, { force: true })
  }
}
