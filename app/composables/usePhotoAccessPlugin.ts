import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

export type PhotoUploadResult = {
  importId: string
  files: Array<{ filename: string; status: string; reason?: string }>
}

type PhotoAccessPlugin = {
  pickAndUpload(options: { journeyId: string; baseUrl: string }): Promise<PhotoUploadResult>
}

const PhotoAccess = registerPlugin<PhotoAccessPlugin>('PhotoAccess')

export function usePhotoAccessPlugin() {
  const isNative = Capacitor.isNativePlatform()

  async function pickAndUpload(journeyId: string): Promise<PhotoUploadResult> {
    return PhotoAccess.pickAndUpload({ journeyId, baseUrl: window.location.origin })
  }

  return { isNative, pickAndUpload }
}
