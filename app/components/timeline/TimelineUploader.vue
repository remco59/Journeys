<script setup lang="ts">
const props = defineProps<{ journeyId: string }>()
const emit = defineEmits<{ uploaded: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)
const lastSummary = ref<string | null>(null)

async function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  error.value = null
  lastSummary.value = null
  uploading.value = true

  const form = new FormData()
  form.append('file', file, file.name)

  try {
    const res = await $fetch<{
      status: string
      parserName?: string
      pointsImported?: number
      visitsImported?: number
      movementsImported?: number
    }>(`/api/journeys/${props.journeyId}/timeline`, { method: 'POST', body: form })

    lastSummary.value =
      res.status === 'duplicate'
        ? 'Already imported.'
        : `Imported via ${res.parserName}: ${res.pointsImported ?? 0} points, ${res.visitsImported ?? 0} visits, ${res.movementsImported ?? 0} movements.`
    emit('uploaded')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Import failed.'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="rounded-2xl border border-dashed border-(--color-line) p-6 text-center">
    <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFileSelected" />
    <button
      class="rounded-lg border border-(--color-line) px-4 py-2 text-sm text-(--color-ink-soft) hover:text-(--color-ink) disabled:opacity-60"
      :disabled="uploading"
      @click="fileInput?.click()"
    >
      {{ uploading ? 'Importing…' : 'Import Google Timeline' }}
    </button>
    <p class="mt-2 text-xs text-(--color-ink-soft)">Optional — a Takeout location-history JSON export.</p>
    <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    <p v-if="lastSummary" class="mt-2 text-sm text-(--color-ink-soft)">{{ lastSummary }}</p>
  </div>
</template>
