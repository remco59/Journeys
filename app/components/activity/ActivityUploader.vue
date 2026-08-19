<script setup lang="ts">
const props = defineProps<{ journeyId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)
const lastResults = ref<Array<{ filename: string; status: string; reason?: string }>>([])

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
      `/api/journeys/${props.journeyId}/activities`,
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
  <div class="rounded-2xl border border-dashed border-(--color-line) p-6 text-center">
    <input ref="fileInput" type="file" accept=".gpx,.tcx,.fit" multiple class="hidden" @change="onFilesSelected" />
    <button
      class="rounded-lg border border-(--color-line) px-4 py-2 text-sm text-(--color-ink-soft) hover:text-(--color-ink) disabled:opacity-60"
      :disabled="uploading"
      @click="fileInput?.click()"
    >
      {{ uploading ? 'Importing…' : 'Import activity (GPX/TCX/FIT)' }}
    </button>
    <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    <ul v-if="lastResults.length" class="mt-3 space-y-1 text-left text-sm text-(--color-ink-soft)">
      <li v-for="r in lastResults" :key="r.filename">
        {{ r.filename }} —
        <span :class="{ 'text-red-600': r.status === 'rejected' }">{{ r.status }}</span>
        <span v-if="r.reason"> ({{ r.reason }})</span>
      </li>
    </ul>
  </div>
</template>
