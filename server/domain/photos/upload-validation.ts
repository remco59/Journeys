import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif'
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50MB per file

export type ValidatedUpload = { mimeType: string; extension: string }

/**
 * Sniffs actual file content rather than trusting the declared MIME type or
 * filename extension — an upload endpoint accepting arbitrary "photos" is a
 * classic spot for a mislabeled malicious file. See architecture plan §22.
 */
export async function validateImageUpload(data: Buffer): Promise<ValidatedUpload> {
  if (data.byteLength === 0) {
    throw new Error('Empty file')
  }
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`)
  }

  const detected = await fileTypeFromBuffer(data)
  if (!detected || !(detected.mime in ALLOWED_MIME_TO_EXT)) {
    throw new Error(`Unsupported or unrecognized image format${detected ? `: ${detected.mime}` : ''}`)
  }

  return { mimeType: detected.mime, extension: ALLOWED_MIME_TO_EXT[detected.mime]! }
}
