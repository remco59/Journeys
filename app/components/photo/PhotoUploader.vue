<script setup lang="ts">
import type { UploadTrackerState } from '~/composables/useUploadTracker'

const props = defineProps<{ journeyId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const { isNative, pickAndUpload } = usePhotoAccessPlugin()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)
const lastResults = ref<Array<{ filename: string; status: string; reason?: string }>>([])
const progress = ref<{ current: number; total: number } | null>(null)
const progressPercent = computed(() =>
  progress.value ? Math.round((progress.value.current / progress.value.total) * 100) : 0
)

const tracker = useUploadTracker()
const root = ref<HTMLElement | null>(null)
const isVisible = ref(true)
let observer: IntersectionObserver | null = null

// Reflects onto the global tracker whenever this uploader stops being on
// screen (its dialog closes, or the page it's on gets navigated away from)
// so PhotoUploadToast knows to pick up where it left off.
function syncTrackerVisibility() {
  if (tracker.value.journeyId === props.journeyId && tracker.value.active) {
    tracker.value.hidden = !isVisible.value
  }
}

function updateTracker(patch: Partial<UploadTrackerState>) {
  tracker.value = { ...tracker.value, journeyId: props.journeyId, hidden: !isVisible.value, ...patch }
}

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    isVisible.value = entries[entries.length - 1]?.isIntersecting ?? false
    syncTrackerVisibility()
  })
  if (root.value) observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  isVisible.value = false
  syncTrackerVisibility()
})

function onUploadClick() {
  if (isNative) {
    onNativePick()
  } else {
    fileInput.value?.click()
  }
}

// On Android, <input type="file"> routes through the system Photo Picker,
// which strips GPS EXIF from every photo unconditionally. The native app
// uses PhotoAccessPlugin instead, which reads originals directly via
// MediaStore so location data survives.
async function onNativePick() {
  error.value = null
  uploading.value = true
  lastResults.value = []
  progress.value = null
  updateTracker({ active: true, current: 0, total: 0, error: null })
  try {
    const res = await pickAndUpload(props.journeyId, (p) => {
      progress.value = { current: p.completed, total: p.total }
      updateTracker({ active: true, current: p.completed, total: p.total })
    })
    lastResults.value = res.files
    emit('uploaded')
    updateTracker({ active: false, error: null })
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Upload failed.'
    error.value = message
    updateTracker({ active: false, error: message })
  } finally {
    uploading.value = false
    progress.value = null
  }
}

async function onFilesSelected(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return

  error.value = null
  uploading.value = true
  lastResults.value = []
  const fileList = Array.from(files)
  progress.value = { current: 0, total: fileList.length }
  updateTracker({ active: true, current: 0, total: fileList.length, error: null })

  try {
    for (const file of fileList) {
      const form = new FormData()
      form.append('file', file, file.name)

      const res = await $fetch<{ files: Array<{ filename: string; status: string; reason?: string }> }>(
        `/api/journeys/${props.journeyId}/photos`,
        { method: 'POST', body: form }
      )
      lastResults.value.push(...res.files)
      progress.value = { current: progress.value.current + 1, total: fileList.length }
      updateTracker({ active: true, current: progress.value.current, total: fileList.length })
    }
    emit('uploaded')
    updateTracker({ active: false, error: null })
  } catch (err: any) {
    const message = err?.data?.statusMessage ?? 'Upload failed.'
    error.value = message
    updateTracker({ active: false, error: message })
  } finally {
    uploading.value = false
    progress.value = null
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div ref="root" class="rounded-2xl border border-dashed border-(--color-stone-line) p-6 text-center">
    <input v-if="!isNative" ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFilesSelected" />
    <button class="btn-primary" :disabled="uploading" :class="{ 'animate-pulse-soft': uploading }" @click="onUploadClick">
      {{ uploading ? 'Uploading…' : 'Upload photos' }}
    </button>
    <p v-if="uploading && progress" class="mt-2 font-mono text-xs text-(--color-ink-soft)">
      Photo {{ progress.current }} of {{ progress.total }} ({{ progressPercent }}%)
    </p>
    <p v-if="error" class="mt-2 text-sm text-(--color-brick)">{{ error }}</p>
    <ul v-if="lastResults.length" class="mt-3 animate-fade-up space-y-1 text-left font-mono text-xs text-(--color-ink-soft)">
      <li v-for="r in lastResults" :key="r.filename">
        {{ r.filename }} —
        <span :class="{ 'text-(--color-brick)': r.status === 'rejected' }">{{ r.status }}</span>
        <span v-if="r.reason"> ({{ r.reason }})</span>
      </li>
    </ul>
  </div>
</template>
