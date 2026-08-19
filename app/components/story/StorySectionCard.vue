<script setup lang="ts">
const props = defineProps<{
  journeyId: string
  section: {
    id: string
    title: string
    placeName: string | null
    arrivalAt: string | null
    departureAt: string | null
    confidence: 'high' | 'medium' | 'low' | 'inferred'
  }
  photos: Array<{ id: string; storageKeyThumb: string | null; capturedAt: string | null; locationSource: string }>
  otherSections: Array<{ id: string; title: string }>
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  merge: [intoSectionId: string]
  movePhoto: [photoId: string, sectionId: string]
  locate: []
}>()

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  inferred: 'Inferred'
}

const mergeTarget = ref('')
function onMergeChange() {
  if (mergeTarget.value) {
    emit('merge', mergeTarget.value)
    mergeTarget.value = ''
  }
}

const managingPhotos = ref(false)
</script>

<template>
  <article class="rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-5">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 class="font-(family-name:--font-display) text-xl font-medium">{{ section.title }}</h3>
        <button
          v-if="section.placeName"
          class="mt-0.5 block text-sm text-(--color-ink-soft) hover:text-(--color-gold) hover:underline"
          @click="emit('locate')"
        >
          📍 {{ section.placeName }}
        </button>
        <p v-if="section.arrivalAt" class="mt-0.5 text-sm text-(--color-ink-soft)">
          {{ new Date(section.arrivalAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) }} ·
          {{ photos.length }} photo{{ photos.length === 1 ? '' : 's' }}
        </p>
      </div>
      <span class="shrink-0 rounded-full border border-(--color-line) px-2 py-0.5 text-xs text-(--color-ink-soft)">
        {{ CONFIDENCE_LABEL[section.confidence] }}
      </span>
    </div>

    <StoryStoryPhotoPreview :journey-id="journeyId" :section-id="section.id" :photos="photos" />

    <PhotoPhotoGrid
      v-if="managingPhotos"
      :photos="photos"
      :other-sections="otherSections"
      class="mt-3"
      @move="(photoId: string, sectionId: string) => emit('movePhoto', photoId, sectionId)"
    />

    <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-(--color-line) pt-3 text-sm text-(--color-ink-soft)">
      <button class="hover:text-(--color-ink)" @click="emit('edit')">Edit</button>
      <button class="hover:text-(--color-ink)" @click="managingPhotos = !managingPhotos">
        {{ managingPhotos ? 'Done' : 'Manage photos' }}
      </button>
      <button class="hover:text-red-600" @click="emit('delete')">Delete</button>
      <select
        v-if="otherSections.length"
        v-model="mergeTarget"
        class="rounded-md border border-(--color-line) bg-transparent px-2 py-1 text-xs"
        @change="onMergeChange"
      >
        <option value="" disabled>Merge into…</option>
        <option v-for="s in otherSections" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
    </div>
  </article>
</template>
