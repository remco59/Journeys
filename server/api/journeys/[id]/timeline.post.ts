import { createHash } from 'node:crypto'
import { getJourneyForOwner } from '../../../domain/journeys/journeys'
import { createImport, completeImport, failImport, createImportFile, findExistingImportFileByChecksum } from '../../../domain/imports/imports'
import { importGoogleTimeline } from '../../../domain/timeline/import-timeline'
import { getStorage } from '../../../storage'
import { clusterJourney } from '../../../domain/sections/cluster-journey'

/**
 * Google Timeline import is optional — the app works fully without it, but
 * when present it improves trace confidence and can hint at transport
 * mode. See architecture plan §07.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const journeyId = getRouterParam(event, 'id')!

  const journey = await getJourneyForOwner(journeyId, user.id)
  if (!journey) {
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  }

  const parts = await readMultipartFormData(event)
  const filePart = (parts ?? []).find((p) => p.filename && p.data && p.data.length > 0)
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const filename = filePart.filename!
  const importRow = await createImport(journeyId, 'google_timeline', user.id)

  try {
    const checksum = createHash('sha256').update(filePart.data).digest('hex')
    const existing = await findExistingImportFileByChecksum(journeyId, checksum)
    if (existing) {
      await completeImport(importRow.id, { status: 'duplicate' })
      return { importId: importRow.id, status: 'duplicate' }
    }

    let doc: unknown
    try {
      doc = JSON.parse(filePart.data.toString('utf-8'))
    } catch {
      throw new Error('File is not valid JSON')
    }

    const result = await importGoogleTimeline(journeyId, importRow.id, doc)

    const storage = getStorage()
    const storageKey = `${journeyId}/${checksum}/original.json`
    await storage.put(storageKey, filePart.data, { contentType: 'application/json' })
    await createImportFile({
      importId: importRow.id,
      journeyId,
      originalFilename: filename,
      storageKey,
      mimeType: 'application/json',
      sizeBytes: filePart.data.length,
      checksumSha256: checksum
    })

    await completeImport(importRow.id, { status: 'completed', ...result })

    // New Timeline observations can upgrade gap traces between sections.
    await clusterJourney(journeyId)

    setResponseStatus(event, 201)
    return { importId: importRow.id, status: 'completed', ...result }
  } catch (err) {
    await failImport(importRow.id, (err as Error).message)
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
