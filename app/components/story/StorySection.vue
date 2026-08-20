<script setup lang="ts">
type Section = {
  id: string
  title: string
  placeName: string | null
  description: string | null
  arrivalAt: string | null
  departureAt: string | null
}
type Photo = { id: string; storageKeyThumb: string | null; storageKeyPreview: string | null; capturedAt: string | null }

const props = defineProps<{ section: Section; photos: Photo[] }>()

const linkBase = useLinkBase()

const dateEyebrow = computed(() => (props.section.arrivalAt ? formatDayMonth(props.section.arrivalAt).toUpperCase() : null))

const metaLine = computed(() => {
  const parts: string[] = []
  if (props.section.placeName && props.section.placeName !== props.section.title) parts.push(props.section.placeName)
  if (props.section.arrivalAt) {
    let time = `Arrived ${formatTime(props.section.arrivalAt)}`
    if (props.section.departureAt) time += ` – ${formatTime(props.section.departureAt)}`
    parts.push(time)
  }
  return parts.join(' · ')
})
</script>

<template>
  <section :id="`section-${section.id}`" class="scroll-mt-24">
    <p v-if="dateEyebrow" class="eyebrow text-(--color-gold)">{{ dateEyebrow }}</p>
    <h2 class="mt-1 font-(family-name:--font-display) text-3xl font-medium uppercase tracking-tight text-(--color-ink)">
      {{ section.title }}
    </h2>
    <p v-if="metaLine" class="mt-1.5 font-mono text-xs text-(--color-ink-soft)">{{ metaLine }}</p>

    <p v-if="section.description" class="mt-4 max-w-prose text-(--color-ink)">{{ section.description }}</p>

    <StoryPhotoGrid :section-id="section.id" :photos="photos" />

    <NuxtLink
      v-if="photos.length"
      :to="`${linkBase}/map?section=${section.id}`"
      class="btn-chip mt-4 inline-flex"
    >
      View on map
    </NuxtLink>
  </section>
</template>
