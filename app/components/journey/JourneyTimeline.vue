<script setup lang="ts">
type Section = {
  id: string
  title: string
  arrivalAt: string
  confidence: 'high' | 'medium' | 'low' | 'inferred'
}
type Photo = { id: string; sectionId: string | null; storageKeyThumb: string | null }

const props = defineProps<{ sections: Section[]; photosBySection: Map<string | null, Photo[]> }>()

const filesBase = useFilesBase()

function photosFor(sectionId: string) {
  return props.photosBySection.get(sectionId) ?? []
}
function thumbUrlFor(sectionId: string) {
  const key = photosFor(sectionId)[0]?.storageKeyThumb
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 pt-8 pb-nav-safe">
    <p class="eyebrow text-(--color-stone)">The journey</p>

    <TransitionGroup v-if="sections.length" tag="div" name="timeline-list" class="mt-5">
      <JourneyTimelineItem
        v-for="(section, i) in sections"
        :key="section.id"
        :section="section"
        :photo-count="photosFor(section.id).length"
        :thumb-url="thumbUrlFor(section.id)"
        :is-last="i === sections.length - 1"
      />
    </TransitionGroup>
    <p v-else class="mt-4 text-sm text-(--color-ink-soft)">
      No places yet — add some photos and your journey will start building itself.
    </p>
  </div>
</template>
