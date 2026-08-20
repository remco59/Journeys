import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

export type PhotoUploadResult = {
  importId: string
  files: Array<{ filename: string; status: string; reason?: string }>
}

export type PhotoUploadProgress = { completed: number; total: number }

type PhotoAccessPlugin = {
  pickAndUpload(options: { journeyId: string; baseUrl: string }): Promise<PhotoUploadResult>
  addListener(
    eventName: 'photoUploadProgress',
    listenerFunc: (progress: PhotoUploadProgress) => void
  ): Promise<{ remove: () => void }>
}

const PhotoAccess = registerPlugin<PhotoAccessPlugin>('PhotoAccess')

export function usePhotoAccessPlugin() {
  const isNative = Capacitor.isNativePlatform()

  async function pickAndUpload(
    journeyId: string,
    onProgress?: (progress: PhotoUploadProgress) => void
  ): Promise<PhotoUploadResult> {
    const listenerHandle = onProgress ? await PhotoAccess.addListener('photoUploadProgress', onProgress) : null
    try {
      return await PhotoAccess.pickAndUpload({ journeyId, baseUrl: window.location.origin })
    } finally {
      await listenerHandle?.remove()
    }
  }

  return { isNative, pickAndUpload }
}
