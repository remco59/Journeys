<script setup lang="ts">
type Section = {
  id: string
  title: string
  placeName: string | null
  description: string | null
  arrivalAt: string | null
  source: 'auto' | 'user_override'
}
type Photo = {
  id: string
  storageKeyThumb: string | null
  capturedAt: string | null
  caption: string | null
  locationSource: string
  sectionId: string | null
  lat?: number | null
  lon?: number | null
}

const props = defineProps<{
  section: Section
  photos: Photo[]
  isFirst: boolean
  isLast: boolean
  hasNext: boolean
  journeyCoverPhotoId: string | null
  selectMode?: boolean
  selectedIds?: Set<string>
}>()

const emit = defineEmits<{
  moveUp: []
  moveDown: []
  mergeWithNext: []
  delete: []
  editPhoto: [photo: Photo]
  setCover: [photoId: string]
  toggleSelect: [photoId: string]
  saved: []
}>()

const filesBase = useFilesBase()
const expanded = ref(false)

// Selecting photos across sections only makes sense if the grid holding
// them is visible — auto-expand on entering select mode, but never force a
// collapse back when it turns off (the user may have expanded it manually).
watch(
  () => props.selectMode,
  (on) => {
    if (on) expanded.value = true
  }
)

const title = ref(props.section.title)
const description = ref(props.section.description ?? '')
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let saving = false

function scheduleSave() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(save, 700)
}
async function save() {
  if (title.value.trim() === props.section.title && (description.value || null) === props.section.description) return
  saving = true
  try {
    await $fetch(`/api/sections/${props.section.id}`, {
      method: 'PATCH',
      body: { title: title.value.trim() || props.section.title, description: description.value || null }
    })
    emit('saved')
  } finally {
    saving = false
  }
}
watch([title, description], scheduleSave)
watch(
  () => props.section,
  (s) => {
    if (saving) return
    title.value = s.title
    description.value = s.description ?? ''
  }
)

function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}

const dateLabel = computed(() => (props.section.arrivalAt ? formatDayMonth(props.section.arrivalAt) : null))
</script>

<template>
  <div class="rounded-2xl bg-(--color-paper-raised) shadow-[0_2px_10px_rgba(20,26,32,0.05)]">
    <div class="flex items-center gap-3 p-3">
      <div class="flex shrink-0 flex-col gap-0.5 text-(--color-ink-soft)/60">
        <button type="button" :disabled="isFirst" class="rounded p-0.5 disabled:opacity-25 hover:text-(--color-ink)" aria-label="Move up" @click="emit('moveUp')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
        </button>
        <button type="button" :disabled="isLast" class="rounded p-0.5 disabled:opacity-25 hover:text-(--color-ink)" aria-label="Move down" @click="emit('moveDown')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-(--color-paper-raised)">
        <img v-if="url(photos[0]?.storageKeyThumb ?? null)" :src="url(photos[0]?.storageKeyThumb ?? null)!" class="h-full w-full object-cover" alt="" />
      </div>

      <button type="button" class="min-w-0 flex-1 text-left" @click="expanded = !expanded">
        <p class="truncate font-(family-name:--font-display) text-lg font-medium">{{ section.title }}</p>
        <p class="mt-0.5 truncate font-mono text-xs text-(--color-ink-soft)">
          <span v-if="dateLabel">{{ dateLabel }} · </span>{{ photos.length }} photo{{ photos.length === 1 ? '' : 's' }} ·
          {{ section.source === 'auto' ? 'auto' : 'edited' }}
        </p>
      </button>

      <button type="button" class="shrink-0 p-1 text-(--color-ink-soft)" @click="expanded = !expanded" :aria-label="expanded ? 'Collapse' : 'Expand'">
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class="transition-transform" :class="{ 'rotate-180': expanded }"
        ><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>

    <div v-if="expanded" class="border-t border-(--color-line) px-4 pb-4 pt-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="eyebrow text-(--color-ink-soft)">Name</span>
        <input v-model="title" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <label class="mt-3 flex flex-col gap-1 text-sm">
        <span class="eyebrow text-(--color-ink-soft)">Description</span>
        <textarea v-model="description" rows="3" placeholder="Add a note about this part of the trip…" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <p class="mt-4 eyebrow text-(--color-ink-soft)">
        {{ selectMode ? 'Photos — tap to select' : 'Photos — tap to edit, star to set as cover' }}
      </p>
      <div v-if="photos.length" class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
        <div v-for="p in photos" :key="p.id" class="group relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)">
          <button
            type="button"
            class="block h-full w-full"
            @click="selectMode ? emit('toggleSelect', p.id) : emit('editPhoto', p)"
          >
            <img v-if="url(p.storageKeyThumb)" :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" :class="{ 'opacity-60': selectMode && selectedIds?.has(p.id) }" loading="lazy" alt="" />
          </button>
          <button
            v-if="!selectMode"
            type="button"
            class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-(--color-canvas)/50 text-xs backdrop-blur-sm"
            :class="p.id === journeyCoverPhotoId ? 'text-(--color-gold)' : 'text-(--color-cream)/70 opacity-0 group-hover:opacity-100'"
            title="Set as trip cover"
            @click.stop="emit('setCover', p.id)"
          >
            ★
          </button>
          <div
            v-else
            class="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
            :class="selectedIds?.has(p.id) ? 'bg-(--color-teal) text-(--color-cream)' : 'bg-(--color-canvas)/50 text-(--color-cream)/70'"
          >
            <svg v-if="selectedIds?.has(p.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
        </div>
      </div>
      <p v-else class="mt-2 text-sm text-(--color-ink-soft)">No photos in this section yet.</p>

      <div class="mt-4 flex flex-wrap gap-2 border-t border-(--color-line) pt-3">
        <button v-if="hasNext" type="button" class="btn-chip" @click="emit('mergeWithNext')">Merge with next</button>
        <button type="button" class="btn-chip text-(--color-brick)" @click="emit('delete')">Delete section</button>
      </div>
    </div>
  </div>
</template>
