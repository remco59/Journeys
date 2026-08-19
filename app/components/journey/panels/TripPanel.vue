<script setup lang="ts">
type Section = {
  id: string
  title: string
  placeName: string | null
  arrivalAt: string | null
}

const props = defineProps<{
  journeyId: string
  sections: Section[]
  photosBySection: Map<string | null, Array<{ id: string }>>
}>()

function photoCount(sectionId: string) {
  return props.photosBySection.get(sectionId)?.length ?? 0
}

function arrivalLabel(section: Section) {
  if (!section.arrivalAt) return null
  const d = new Date(section.arrivalAt)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

function arrivalTimeLabel(section: Section) {
  if (!section.arrivalAt) return null
  return new Date(section.arrivalAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10">
    <div v-if="sections.length" class="space-y-3">
      <NuxtLink
        v-for="section in sections"
        :key="section.id"
        :to="`/journeys/${journeyId}/story`"
        class="block rounded-xl border border-(--color-line) bg-(--color-paper-raised) p-4 transition hover:border-(--color-gold)"
      >
        <p class="font-(family-name:--font-display) text-lg font-medium">{{ section.title }}</p>
        <p class="mt-0.5 text-sm text-(--color-ink-soft)">
          <span v-if="arrivalLabel(section)">{{ arrivalLabel(section) }} · </span>
          {{ photoCount(section.id) }} photo{{ photoCount(section.id) === 1 ? '' : 's' }}
          <span v-if="arrivalTimeLabel(section)"> · Arrived {{ arrivalTimeLabel(section) }}</span>
        </p>
      </NuxtLink>
    </div>
    <p v-else class="text-sm text-(--color-ink-soft)">
      No sections yet — head to the Story tab and upload some photos to get started.
    </p>
  </div>
</template>
