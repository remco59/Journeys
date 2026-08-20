<script setup lang="ts">
type Journey = { id: string; title: string; description: string | null; startDate: string; endDate: string; coverPhotoId: string | null }
type Section = {
  id: string
  title: string
  placeName: string | null
  description: string | null
  arrivalAt: string
  source: 'auto' | 'user_override'
  lat?: number | null
  lon?: number | null
}
type Photo = {
  id: string
  sectionId: string | null
  storageKeyThumb: string | null
  capturedAt: string | null
  caption: string | null
  locationSource: string
  lat?: number | null
  lon?: number | null
  showInStory?: boolean
}

type Activity = {
  id: string
  title: string
  type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
  coverPhotoId?: string | null
}

const props = defineProps<{ journeyId: string; journey: Journey; sections: Section[]; photos: Photo[]; activities: Activity[] }>()
const emit = defineEmits<{ refresh: [] }>()

const ACTIVITY_TYPE_LABEL: Record<Activity['type'], string> = {
  cycling: 'Cycling',
  hiking: 'Hiking',
  running: 'Running',
  walking: 'Walking',
  swimming: 'Swimming',
  other: 'Activity'
}
const activityEditor = ref<{ open: (a: Activity) => void } | null>(null)
function openEditActivity(activity: Activity) {
  activityEditor.value?.open(activity)
}

const photosBySection = computed(() => {
  const map = new Map<string | null, Photo[]>()
  for (const photo of props.photos) {
    const key = photo.sectionId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }
  return map
})
const unsortedPhotos = computed(() => photosBySection.value.get(null) ?? [])
const sectionOptions = computed(() => props.sections.map((s) => ({ id: s.id, title: s.title })))

const filesBase = useFilesBase()
function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}

async function reorder(newOrder: Section[]) {
  await $fetch(`/api/journeys/${props.journeyId}/sections/reorder`, {
    method: 'POST',
    body: { orderedIds: newOrder.map((s) => s.id) }
  })
  emit('refresh')
}
function moveUp(index: number) {
  if (index <= 0) return
  const next = [...props.sections]
  ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
  reorder(next)
}
function moveDown(index: number) {
  if (index >= props.sections.length - 1) return
  const next = [...props.sections]
  ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
  reorder(next)
}

async function mergeWithNext(index: number) {
  const source = props.sections[index]!
  const target = props.sections[index + 1]
  if (!target) return
  await $fetch(`/api/sections/${source.id}/merge`, { method: 'POST', body: { intoSectionId: target.id } })
  emit('refresh')
}

async function deleteSection(sectionId: string) {
  if (!confirm('Delete this section? Its photos become unsorted, not deleted.')) return
  await $fetch(`/api/sections/${sectionId}`, { method: 'DELETE' })
  emit('refresh')
}

async function setCover(photoId: string) {
  await $fetch(`/api/photos/${photoId}/set-cover`, { method: 'POST' })
  emit('refresh')
}

async function updateStoryPhotos(changes: Array<{ id: string; show: boolean }>) {
  await Promise.all(
    changes.map(({ id, show }) => $fetch(`/api/photos/${id}/show-in-story`, { method: 'POST', body: { show } }))
  )
  emit('refresh')
}

const photoEditor = ref<{ open: (p: any, point: { lat: number; lon: number } | null) => void } | null>(null)
function openEditPhoto(photo: Photo) {
  const point = photo.lat != null && photo.lon != null ? { lat: photo.lat, lon: photo.lon } : null
  photoEditor.value?.open(photo, point)
}
function onPhotoSaved() {
  emit('refresh')
}

// --- bulk photo selection ---
const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const bulkTarget = ref<string>('')
const bulkBusy = ref(false)

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value = new Set()
}
function toggleSelect(photoId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(photoId)) next.delete(photoId)
  else next.add(photoId)
  selectedIds.value = next
}
function clearSelection() {
  selectedIds.value = new Set()
}

async function bulkMove() {
  if (!selectedIds.value.size || bulkBusy.value) return
  bulkBusy.value = true
  try {
    await $fetch(`/api/journeys/${props.journeyId}/photos/bulk-move`, {
      method: 'POST',
      body: { photoIds: [...selectedIds.value], sectionId: bulkTarget.value || null }
    })
    clearSelection()
    emit('refresh')
  } finally {
    bulkBusy.value = false
  }
}

async function bulkDelete() {
  if (!selectedIds.value.size || bulkBusy.value) return
  if (!confirm(`Delete ${selectedIds.value.size} photo${selectedIds.value.size === 1 ? '' : 's'}? This cannot be undone.`)) return
  bulkBusy.value = true
  try {
    await $fetch(`/api/journeys/${props.journeyId}/photos/bulk-delete`, {
      method: 'POST',
      body: { photoIds: [...selectedIds.value] }
    })
    clearSelection()
    emit('refresh')
  } finally {
    bulkBusy.value = false
  }
}

// --- journey details (title, description, dates) ---
const jTitle = ref(props.journey.title)
const jDescription = ref(props.journey.description ?? '')
const jStart = ref(props.journey.startDate)
const jEnd = ref(props.journey.endDate)
let jTimer: ReturnType<typeof setTimeout> | undefined
let jSaving = false
function scheduleJourneySave() {
  if (jTimer) clearTimeout(jTimer)
  jTimer = setTimeout(saveJourney, 700)
}
async function saveJourney() {
  jSaving = true
  try {
    await $fetch(`/api/journeys/${props.journeyId}`, {
      method: 'PATCH',
      body: { title: jTitle.value, description: jDescription.value || null, startDate: jStart.value, endDate: jEnd.value }
    })
    emit('refresh')
  } finally {
    jSaving = false
  }
}
watch([jTitle, jDescription, jStart, jEnd], scheduleJourneySave)
watch(
  () => props.journey,
  (j) => {
    if (jSaving) return
    jTitle.value = j.title
    jDescription.value = j.description ?? ''
    jStart.value = j.startDate
    jEnd.value = j.endDate
  }
)

async function onDeleteJourney() {
  if (!confirm(`Delete "${props.journey.title}"? This cannot be undone.`)) return
  await $fetch(`/api/journeys/${props.journeyId}`, { method: 'DELETE' })
  await navigateTo('/')
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 pt-8 pb-nav-safe">
    <JourneyBackButton class="mb-4" />
    <p class="eyebrow text-(--color-stone)">Edit</p>
    <h1 class="mt-1 font-(family-name:--font-display) text-3xl font-medium">Shape your story</h1>
    <p class="mt-2 max-w-md text-sm text-(--color-ink-soft)">
      Sections were grouped automatically from your photos' GPS and timestamps — nothing is locked. Changes save automatically.
    </p>

    <div class="mt-6">
      <JourneyTripCoverPicker :cover-photo-id="journey.coverPhotoId" :photos="photos" @changed="emit('refresh')" />
    </div>

    <div v-if="photos.length" class="mt-5 flex items-center justify-between">
      <p class="eyebrow text-(--color-stone)">Photos</p>
      <button type="button" class="btn-chip" @click="toggleSelectMode">
        {{ selectMode ? 'Done selecting' : 'Select photos' }}
      </button>
    </div>

    <TransitionGroup v-if="sections.length" tag="div" name="section-list" class="relative mt-3 flex flex-col gap-3">
      <StorySectionEditor
        v-for="(section, i) in sections"
        :key="section.id"
        :section="section"
        :photos="photosBySection.get(section.id) ?? []"
        :is-first="i === 0"
        :is-last="i === sections.length - 1"
        :has-next="i < sections.length - 1"
        :journey-cover-photo-id="journey.coverPhotoId"
        :select-mode="selectMode"
        :selected-ids="selectedIds"
        @move-up="moveUp(i)"
        @move-down="moveDown(i)"
        @merge-with-next="mergeWithNext(i)"
        @delete="deleteSection(section.id)"
        @edit-photo="openEditPhoto"
        @set-cover="setCover"
        @toggle-select="toggleSelect"
        @update-story-photos="updateStoryPhotos"
        @saved="emit('refresh')"
      />
    </TransitionGroup>
    <p v-else class="mt-6 text-sm text-(--color-ink-soft)">No sections yet — add photos to get started.</p>

    <div v-if="unsortedPhotos.length" class="mt-6 rounded-2xl border border-dashed border-(--color-stone-line) p-4">
      <p class="font-(family-name:--font-display) text-lg font-medium text-(--color-ink-soft)">Unsorted ({{ unsortedPhotos.length }})</p>
      <p class="mt-1 text-xs text-(--color-ink-soft)">
        {{ selectMode ? 'Tap to select.' : 'Photos without a place yet — tap one to assign it to a section.' }}
      </p>
      <div class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        <div v-for="p in unsortedPhotos" :key="p.id" class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)">
          <button
            type="button"
            class="block h-full w-full"
            @click="selectMode ? toggleSelect(p.id) : openEditPhoto(p)"
          >
            <img v-if="url(p.storageKeyThumb)" :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" :class="{ 'opacity-60': selectMode && selectedIds.has(p.id) }" loading="lazy" alt="" />
          </button>
          <div
            v-if="selectMode"
            class="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
            :class="selectedIds.has(p.id) ? 'bg-(--color-teal) text-(--color-cream)' : 'bg-(--color-canvas)/50 text-(--color-cream)/70'"
          >
            <svg v-if="selectedIds.has(p.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
        </div>
      </div>
    </div>

    <section v-if="activities.length" class="mt-8 border-t border-(--color-line) pt-6">
      <p class="eyebrow text-(--color-stone)">Activities</p>
      <div class="mt-3 flex flex-col gap-2">
        <button
          v-for="a in activities"
          :key="a.id"
          type="button"
          class="flex items-center justify-between rounded-xl bg-(--color-paper-raised) px-4 py-2.5 text-left"
          @click="openEditActivity(a)"
        >
          <span>
            <span class="block font-medium">{{ a.title }}</span>
            <span class="block font-mono text-xs text-(--color-ink-soft)">{{ ACTIVITY_TYPE_LABEL[a.type] }}</span>
          </span>
          <span class="text-xs text-(--color-ink-soft)">Edit</span>
        </button>
      </div>
    </section>

    <section class="mt-10 border-t border-(--color-line) pt-6">
      <p class="eyebrow text-(--color-stone)">Journey</p>
      <label class="mt-3 flex flex-col gap-1 text-sm">
        Title
        <input v-model="jTitle" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>
      <label class="mt-3 flex flex-col gap-1 text-sm">
        Description
        <textarea v-model="jDescription" rows="2" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>
      <div class="mt-3 flex gap-3">
        <label class="flex flex-1 flex-col gap-1 text-sm">
          Start date
          <input v-model="jStart" type="date" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
        <label class="flex flex-1 flex-col gap-1 text-sm">
          End date
          <input v-model="jEnd" type="date" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
      </div>
      <button type="button" class="btn-chip mt-4 text-(--color-brick)" @click="onDeleteJourney">Delete journey</button>
    </section>

    <ClientOnly>
      <PhotoEditorDialog ref="photoEditor" :sections="sectionOptions" @saved="onPhotoSaved" @deleted="onPhotoSaved" />
      <StoryActivityEditorDialog
        ref="activityEditor"
        :journey-id="journeyId"
        :photos="photos"
        @saved="emit('refresh')"
        @deleted="emit('refresh')"
        @refresh-photos="emit('refresh')"
      />
    </ClientOnly>

    <Transition name="view-fade">
      <div
        v-if="selectedIds.size"
        class="fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-(--color-canvas)/94 p-2.5 shadow-lg shadow-black/25 backdrop-blur-md"
        style="bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px))"
      >
        <span class="shrink-0 pl-1.5 font-mono text-xs text-(--color-cream)/70">{{ selectedIds.size }} selected</span>
        <select
          v-model="bulkTarget"
          class="min-w-0 flex-1 rounded-xl border-none bg-(--color-paper-raised)/15 px-2 py-1.5 text-sm text-(--color-cream)"
        >
          <option value="">Unsorted</option>
          <option v-for="s in sectionOptions" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
        <button type="button" class="btn-primary shrink-0 !px-3 !py-1.5 text-xs" :disabled="bulkBusy" @click="bulkMove">Move</button>
        <button type="button" class="icon-btn shrink-0 !bg-(--color-brick)/70" aria-label="Delete selected" :disabled="bulkBusy" @click="bulkDelete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          </svg>
        </button>
        <button type="button" class="icon-btn shrink-0" aria-label="Clear selection" @click="clearSelection">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </Transition>
  </div>
</template>
