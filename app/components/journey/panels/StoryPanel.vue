<script setup lang="ts">
import { useMapSyncStore } from '../../../stores/mapSync'

type SectionSummary = { id: string; title: string; placeName: string | null; description: string | null }

const props = defineProps<{
  journeyId: string
  sections: Array<
    SectionSummary & {
      arrivalAt: string | null
      departureAt: string | null
      confidence: 'high' | 'medium' | 'low' | 'inferred'
    }
  >
  photos: Array<{ id: string; sectionId: string | null; storageKeyThumb: string | null; capturedAt: string | null; locationSource: string }>
}>()

const emit = defineEmits<{ refresh: [] }>()

const mapSync = useMapSyncStore()

const photosBySection = computed(() => {
  const map = new Map<string | null, typeof props.photos>()
  for (const photo of props.photos) {
    const key = photo.sectionId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }
  return map
})
const unsortedPhotos = computed(() => photosBySection.value.get(null) ?? [])

function otherSectionsFor(sectionId: string | null) {
  return props.sections.filter((s) => s.id !== sectionId).map((s) => ({ id: s.id, title: s.title }))
}

const reclustering = ref(false)
async function onRecluster() {
  reclustering.value = true
  try {
    await $fetch(`/api/journeys/${props.journeyId}/cluster`, { method: 'POST' })
    emit('refresh')
  } finally {
    reclustering.value = false
  }
}

const sectionEditor = ref<{ open: () => void } | null>(null)
const editingSection = ref<SectionSummary | null>(null)

function openNewSection() {
  editingSection.value = null
  sectionEditor.value?.open()
}
function openEditSection(section: SectionSummary) {
  editingSection.value = section
  sectionEditor.value?.open()
}

async function onDeleteSection(sectionId: string) {
  if (!confirm('Delete this section? Its photos become unsorted, not deleted.')) return
  await $fetch(`/api/sections/${sectionId}`, { method: 'DELETE' })
  emit('refresh')
}

async function onMergeSection(sourceId: string, intoSectionId: string) {
  await $fetch(`/api/sections/${sourceId}/merge`, { method: 'POST', body: { intoSectionId } })
  emit('refresh')
}

async function onMovePhoto(photoId: string, sectionId: string) {
  await $fetch(`/api/photos/${photoId}`, { method: 'PATCH', body: { sectionId } })
  emit('refresh')
}

async function onLocate(sectionId: string) {
  mapSync.select(sectionId)
  await navigateTo(`/journeys/${props.journeyId}/map`)
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-10">
    <div class="mb-6 flex items-start justify-between gap-4">
      <p class="text-sm text-(--color-ink-soft)">{{ sections.length }} section{{ sections.length === 1 ? '' : 's' }}</p>
      <div class="flex shrink-0 gap-2">
        <button
          class="rounded-lg border border-(--color-line) px-3 py-1.5 text-sm text-(--color-ink-soft) hover:text-(--color-ink)"
          @click="openNewSection"
        >
          New section
        </button>
        <button
          class="rounded-lg border border-(--color-line) px-3 py-1.5 text-sm text-(--color-ink-soft) hover:text-(--color-ink) disabled:opacity-60"
          :disabled="reclustering"
          @click="onRecluster"
        >
          {{ reclustering ? 'Reclustering…' : 'Recluster now' }}
        </button>
      </div>
    </div>

    <PhotoPhotoUploader :journey-id="journeyId" class="mb-8" @uploaded="emit('refresh')" />

    <div class="space-y-5">
      <StoryStorySectionCard
        v-for="section in sections"
        :key="section.id"
        :journey-id="journeyId"
        :section="section"
        :photos="photosBySection.get(section.id) ?? []"
        :other-sections="otherSectionsFor(section.id)"
        @edit="openEditSection(section)"
        @delete="onDeleteSection(section.id)"
        @merge="(intoId: string) => onMergeSection(section.id, intoId)"
        @move-photo="onMovePhoto"
        @locate="onLocate(section.id)"
      />

      <div v-if="unsortedPhotos.length" class="rounded-2xl border border-dashed border-(--color-line) p-5">
        <h3 class="mb-3 font-(family-name:--font-display) text-lg font-medium text-(--color-ink-soft)">
          Unsorted ({{ unsortedPhotos.length }})
        </h3>
        <PhotoPhotoGrid :photos="unsortedPhotos" :other-sections="otherSectionsFor(null)" @move="onMovePhoto" />
      </div>

      <p v-if="!sections.length && !unsortedPhotos.length" class="text-sm text-(--color-ink-soft)">
        No photos yet — upload some to see the Story build itself.
      </p>
    </div>

    <ClientOnly>
      <StorySectionEditorDialog ref="sectionEditor" :journey-id="journeyId" :section="editingSection" @saved="emit('refresh')" />
    </ClientOnly>
  </div>
</template>
