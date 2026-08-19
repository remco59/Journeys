import sharp from 'sharp'

const THUMB_SIZE = 320
const PREVIEW_SIZE = 1600

export type DerivedImages = {
  thumb: Buffer
  preview: Buffer
}

/**
 * Orientation-correct thumbnail (Story/Gallery grid) and preview (lightbox)
 * variants. The original buffer is never modified or re-encoded here.
 */
export async function generateDerivedImages(original: Buffer): Promise<DerivedImages> {
  const base = sharp(original, { failOn: 'none' }).rotate() // bakes in EXIF orientation

  const [thumb, preview] = await Promise.all([
    base
      .clone()
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
    base
      .clone()
      .resize({ width: PREVIEW_SIZE, height: PREVIEW_SIZE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  ])

  return { thumb, preview }
}
