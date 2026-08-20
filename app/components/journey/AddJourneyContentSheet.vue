<script setup lang="ts">
type Mode = 'photos' | 'activity' | 'timeline' | 'section' | null

const props = defineProps<{ journeyId: string }>()
const emit = defineEmits<{ refresh: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const mode = ref<Mode>(null)
const reclustering = ref(false)
const reclusterMessage = ref<string | null>(null)

const OPTIONS: Array<{ mode: Exclude<Mode, null> | 'recluster'; label: string; hint?: string }> = [
  { mode: 'photos', label: 'Add photos' },
  { mode: 'activity', label: 'Import activity', hint: 'GPX, TCX or FIT' },
  { mode: 'timeline', label: 'Import Google Timeline', hint: 'Optional — a Takeout export' },
  { mode: 'section', label: 'Create section' },
  { mode: 'recluster', label: 'Recluster journey', hint: 'Regroup unsorted photos automatically' }
]

function open(initial?: Exclude<Mode, null>) {
  mode.value = initial ?? null
  reclusterMessage.value = null
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

function select(m: (typeof OPTIONS)[number]['mode']) {
  if (m === 'recluster') return onRecluster()
  mode.value = m
}

async function onRecluster() {
  reclustering.value = true
  reclusterMessage.value = null
  try {
    await $fetch(`/api/journeys/${props.journeyId}/cluster`, { method: 'POST' })
    reclusterMessage.value = 'Journey reclustered.'
    emit('refresh')
  } finally {
    reclustering.value = false
  }
}

function onUploaded() {
  emit('refresh')
}

// --- inline "create section" form ---
const sectionTitle = ref('')
const sectionPlace = ref('')
const sectionSubmitting = ref(false)
const sectionError = ref<string | null>(null)

async function createSection() {
  sectionError.value = null
  sectionSubmitting.value = true
  try {
    await $fetch(`/api/journeys/${props.journeyId}/sections`, {
      method: 'POST',
      body: { title: sectionTitle.value, placeName: sectionPlace.value || undefined }
    })
    sectionTitle.value = ''
    sectionPlace.value = ''
    emit('refresh')
    close()
  } catch (err: any) {
    sectionError.value = err?.data?.statusMessage ?? 'Could not create section.'
  } finally {
    sectionSubmitting.value = false
  }
}
</script>

<template>
  <dialog ref="dialog" class="sheet" @close="mode = null">
    <div class="sheet-handle" />

    <div v-if="!mode" class="flex flex-col gap-3 p-6 pt-2">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">Add to your journey</h2>
      <p v-if="reclusterMessage" class="animate-fade-up text-sm text-(--color-teal)">{{ reclusterMessage }}</p>
      <button
        v-for="opt in OPTIONS"
        :key="opt.mode"
        type="button"
        class="flex items-center justify-between rounded-xl bg-(--color-paper-raised) px-4 py-3 text-left transition hover:bg-(--color-paper-raised)/70"
        :disabled="opt.mode === 'recluster' && reclustering"
        @click="select(opt.mode)"
      >
        <span>
          <span class="block font-medium">{{ opt.mode === 'recluster' && reclustering ? 'Reclustering…' : opt.label }}</span>
          <span v-if="opt.hint" class="block font-mono text-xs text-(--color-ink-soft)">{{ opt.hint }}</span>
        </span>
        <span class="text-(--color-ink-soft)">›</span>
      </button>
    </div>

    <div v-else class="flex flex-col gap-3 p-6 pt-2">
      <button type="button" class="self-start text-sm text-(--color-ink-soft) hover:text-(--color-ink)" @click="mode = null">‹ Back</button>

      <PhotoUploader v-if="mode === 'photos'" :journey-id="journeyId" @uploaded="onUploaded" />
      <ActivityUploader v-else-if="mode === 'activity'" :journey-id="journeyId" @uploaded="onUploaded" />
      <TimelineUploader v-else-if="mode === 'timeline'" :journey-id="journeyId" @uploaded="onUploaded" />

      <form v-else-if="mode === 'section'" class="flex flex-col gap-3" @submit.prevent="createSection">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">New section</h2>
        <label class="flex flex-col gap-1 text-sm">
          Title
          <input v-model="sectionTitle" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          Place name
          <input v-model="sectionPlace" placeholder="Milano, Italy" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
        <p v-if="sectionError" class="text-sm text-(--color-brick)">{{ sectionError }}</p>
        <button type="submit" :disabled="sectionSubmitting" class="btn-primary self-end">{{ sectionSubmitting ? 'Creating…' : 'Create' }}</button>
      </form>
    </div>
  </dialog>
</template>
