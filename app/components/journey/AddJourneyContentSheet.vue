<script setup lang="ts">
type Mode = 'photos' | 'activity' | 'timeline' | 'section' | null
type Photo = { id: string; sectionId: string | null; storageKeyThumb: string | null }

const props = defineProps<{ journeyId: string; photos: Photo[] }>()
const emit = defineEmits<{ refresh: [] }>()

const filesBase = useFilesBase()
function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}
const unsortedPhotos = computed(() => props.photos.filter((p) => p.sectionId === null))

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
  if (mode.value === 'section') resetSectionForm()
  guard.reset()
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
// Only the "create section" form holds user input that isn't already saved —
// photo/activity/timeline uploads apply as soon as a file is picked.
const isDirty = () =>
  mode.value === 'section' &&
  (!!sectionTitle.value || !!sectionPlace.value || selectedPhotoIds.value.size > 0 || !!sectionDateLocal.value || !!sectionPoint.value)
const guard = useCloseGuard(isDirty, close)
defineExpose({ open })

function select(m: (typeof OPTIONS)[number]['mode']) {
  if (m === 'recluster') return onRecluster()
  if (m === 'section') resetSectionForm()
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
// A section needs a real arrival time and location before it can exist —
// either derived from photos the user picks here, or entered by hand.
const sectionTitle = ref('')
const sectionPlace = ref('')
const sectionSource = ref<'photos' | 'manual'>('photos')
const selectedPhotoIds = ref<Set<string>>(new Set())
const sectionDateLocal = ref('')
const sectionPoint = ref<{ lat: number; lon: number } | null>(null)
const sectionSubmitting = ref(false)
const sectionError = ref<string | null>(null)

function resetSectionForm() {
  sectionTitle.value = ''
  sectionPlace.value = ''
  sectionSource.value = unsortedPhotos.value.length ? 'photos' : 'manual'
  selectedPhotoIds.value = new Set()
  sectionDateLocal.value = ''
  sectionPoint.value = null
  sectionError.value = null
}

function toggleSectionPhoto(photoId: string) {
  const next = new Set(selectedPhotoIds.value)
  if (next.has(photoId)) next.delete(photoId)
  else next.add(photoId)
  selectedPhotoIds.value = next
}

const canSubmitSection = computed(() => {
  if (!sectionTitle.value.trim()) return false
  if (sectionSource.value === 'photos') return selectedPhotoIds.value.size > 0
  return !!sectionDateLocal.value && !!sectionPoint.value
})

async function createSection() {
  if (!canSubmitSection.value) return
  sectionError.value = null
  sectionSubmitting.value = true
  try {
    const body: Record<string, unknown> = { title: sectionTitle.value, placeName: sectionPlace.value || undefined }
    if (sectionSource.value === 'photos') {
      body.photoIds = [...selectedPhotoIds.value]
    } else {
      body.arrivalAt = new Date(sectionDateLocal.value).toISOString()
      body.lat = sectionPoint.value!.lat
      body.lon = sectionPoint.value!.lon
    }
    await $fetch(`/api/journeys/${props.journeyId}/sections`, { method: 'POST', body })
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
  <dialog ref="dialog" class="sheet" @close="mode = null" @click.self="guard.requestClose" @cancel.prevent="guard.requestClose">
    <div class="sheet-handle" />

    <div v-if="!mode" class="flex flex-col gap-3 p-6 pt-2">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Add to your journey</h2>
        <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="guard.requestClose">✕</button>
      </div>
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
      <div class="flex items-center justify-between">
        <button type="button" class="text-sm text-(--color-ink-soft) hover:text-(--color-ink)" @click="mode = null">‹ Back</button>
        <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="guard.requestClose">✕</button>
      </div>

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

        <p class="text-xs text-(--color-ink-soft)">
          A section needs a date and a place — pick photos to derive them from, or set them by hand.
        </p>
        <div v-if="unsortedPhotos.length" class="flex gap-2">
          <button
            type="button"
            class="btn-chip flex-1"
            :class="{ 'bg-(--color-ink) text-(--color-cream)': sectionSource === 'photos' }"
            @click="sectionSource = 'photos'"
          >
            From photos
          </button>
          <button
            type="button"
            class="btn-chip flex-1"
            :class="{ 'bg-(--color-ink) text-(--color-cream)': sectionSource === 'manual' }"
            @click="sectionSource = 'manual'"
          >
            Manual
          </button>
        </div>
        <p v-else class="text-xs text-(--color-ink-soft)">No unsorted photos yet — upload some first, or set a date and place by hand below.</p>

        <div v-if="sectionSource === 'photos' && unsortedPhotos.length" class="grid grid-cols-4 gap-2 sm:grid-cols-6">
          <button
            v-for="p in unsortedPhotos"
            :key="p.id"
            type="button"
            class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)"
            @click="toggleSectionPhoto(p.id)"
          >
            <img v-if="url(p.storageKeyThumb)" :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" :class="{ 'opacity-60': selectedPhotoIds.has(p.id) }" loading="lazy" alt="" />
            <div
              class="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
              :class="selectedPhotoIds.has(p.id) ? 'bg-(--color-teal) text-(--color-cream)' : 'bg-(--color-canvas)/50 text-(--color-cream)/70'"
            >
              <svg v-if="selectedPhotoIds.has(p.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
          </button>
        </div>

        <template v-else>
          <label class="flex flex-col gap-1 text-sm">
            Date &amp; time
            <input v-model="sectionDateLocal" type="datetime-local" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Location
            <PhotoMapPointPicker v-model="sectionPoint" :clearable="false" />
          </label>
        </template>

        <p v-if="sectionError" class="text-sm text-(--color-brick)">{{ sectionError }}</p>
        <button type="submit" :disabled="sectionSubmitting || !canSubmitSection" class="btn-primary self-end">{{ sectionSubmitting ? 'Creating…' : 'Create' }}</button>
      </form>
    </div>
    <UnsavedChangesGuard :show="guard.confirmingClose.value" @keep="guard.cancelClose" @discard="guard.discardAndClose" />
  </dialog>
</template>
