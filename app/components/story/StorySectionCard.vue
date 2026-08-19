<script setup lang="ts">
defineProps<{
  section: {
    id: string
    title: string
    placeName: string | null
    arrivalAt: string | null
    departureAt: string | null
    confidence: 'high' | 'medium' | 'low' | 'inferred'
  }
  photos: Array<{ id: string; storageKeyThumb: string | null; capturedAt: string | null; locationSource: string }>
}>()

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  inferred: 'Inferred'
}
</script>

<template>
  <article class="rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-5">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 class="font-(family-name:--font-display) text-xl font-medium">{{ section.title }}</h3>
        <p v-if="section.placeName" class="mt-0.5 text-sm text-(--color-ink-soft)">📍 {{ section.placeName }}</p>
        <p v-if="section.arrivalAt" class="mt-0.5 text-sm text-(--color-ink-soft)">
          {{ new Date(section.arrivalAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) }} ·
          {{ photos.length }} photo{{ photos.length === 1 ? '' : 's' }}
        </p>
      </div>
      <span class="shrink-0 rounded-full border border-(--color-line) px-2 py-0.5 text-xs text-(--color-ink-soft)">
        {{ CONFIDENCE_LABEL[section.confidence] }}
      </span>
    </div>
    <PhotoPhotoGrid :photos="photos" />
  </article>
</template>
