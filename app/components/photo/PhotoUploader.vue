<script setup lang="ts">
const props = defineProps<{ journeyId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const { isNative, pickAndUpload } = usePhotoAccessPlugin()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)
const lastResults = ref<Array<{ filename: string; status: string; reason?: string }>>([])

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
  try {
    const res = await pickAndUpload(props.journeyId)
    lastResults.value = res.files
    emit('uploaded')
  } catch (err: any) {
    error.value = typeof err?.message === 'string' ? err.message : 'Upload failed.'
  } finally {
    uploading.value = false
  }
}

async function onFilesSelected(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return

  error.value = null
  uploading.value = true
  lastResults.value = []

  const form = new FormData()
  for (const file of Array.from(files)) {
    form.append('file', file, file.name)
  }

  try {
    const res = await $fetch<{ files: Array<{ filename: string; status: string; reason?: string }> }>(
      `/api/journeys/${props.journeyId}/photos`,
      { method: 'POST', body: form }
    )
    lastResults.value = res.files
    emit('uploaded')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Upload failed.'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="rounded-2xl border border-dashed border-(--color-stone-line) p-6 text-center">
    <input v-if="!isNative" ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFilesSelected" />
    <button class="btn-primary" :disabled="uploading" :class="{ 'animate-pulse-soft': uploading }" @click="onUploadClick">
      {{ uploading ? 'Uploading…' : 'Upload photos' }}
    </button>
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
