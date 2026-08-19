import { createHash } from 'node:crypto'
import path from 'node:path'
import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createImport, completeImport, createImportFile, findExistingImportFileByChecksum } from '../../../domain/imports/imports'
import { createActivityFromImport } from '../../../domain/activities/activities'
import { getActivityImporter } from '../../../import/registry'
import { getStorage } from '../../../storage'
import { clusterJourney } from '../../../domain/sections/cluster-journey'

type UploadResult =
  | { filename: string; status: 'created'; activityIds: string[] }
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
  const importRow = await createImport(journeyId, 'gpx', user.id)
  const results: UploadResult[] = []

  for (const part of fileParts) {
    const filename = part.filename!
    const ext = path.extname(filename)
    const importer = getActivityImporter(ext)

    if (!importer) {
      results.push({ filename, status: 'rejected', reason: `Unsupported file type "${ext}"` })
      continue
    }

    try {
      const checksum = createHash('sha256').update(part.data).digest('hex')
      const existing = await findExistingImportFileByChecksum(journeyId, checksum)
      if (existing) {
        results.push({ filename, status: 'duplicate' })
        continue
      }

      const normalizedActivities = await importer.parse(part.data)
      if (normalizedActivities.length === 0) {
        results.push({ filename, status: 'rejected', reason: 'No usable tracks found in file' })
        continue
      }

      const storageKey = `${journeyId}/${checksum}/original${ext}`
      await storage.put(storageKey, part.data, { contentType: 'application/gpx+xml' })

      const importFile = await createImportFile({
        importId: importRow.id,
        journeyId,
        originalFilename: filename,
        storageKey,
        mimeType: 'application/gpx+xml',
        sizeBytes: part.data.length,
        checksumSha256: checksum
      })

      const activityIds: string[] = []
      for (const normalized of normalizedActivities) {
        const created = await createActivityFromImport(journeyId, importFile.id, normalized)
        if (created) activityIds.push(created.id)
      }

      if (activityIds.length === 0) {
        results.push({ filename, status: 'rejected', reason: 'Track(s) had no timestamps to place in the Story' })
        continue
      }

      results.push({ filename, status: 'created', activityIds })
    } catch (err) {
      results.push({ filename, status: 'rejected', reason: (err as Error).message })
    }
  }

  await completeImport(importRow.id, {
    fileCount: fileParts.length,
    created: results.filter((r) => r.status === 'created').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    rejected: results.filter((r) => r.status === 'rejected').length
  })

  // Sections may need traces reconstructed against the new activity windows.
  await clusterJourney(journeyId)

  setResponseStatus(event, 201)
  return { importId: importRow.id, files: results }
})
