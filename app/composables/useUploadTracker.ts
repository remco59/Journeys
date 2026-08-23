/**
 * Global photo-upload progress, shared across the app via useState.
 *
 * PhotoUploader writes progress here directly (not through a watcher) so
 * updates keep landing even after the component that started the upload
 * unmounts or its dialog closes — uploads run to completion regardless of
 * whether anything on screen is showing them (native uploads run in a
 * foreground service; web uploads are a plain in-flight fetch loop with no
 * AbortController). `hidden` marks that the owning PhotoUploader is no
 * longer visible, which is the toast's cue to take over.
 */
export type UploadTrackerState = {
  active: boolean
  hidden: boolean
  current: number
  total: number
  error: string | null
  journeyId: string | null
}

function initialUploadTrackerState(): UploadTrackerState {
  return { active: false, hidden: false, current: 0, total: 0, error: null, journeyId: null }
}

export function useUploadTracker() {
  return useState<UploadTrackerState>('photoUploadTracker', initialUploadTrackerState)
}
