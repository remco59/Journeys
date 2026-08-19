<script setup lang="ts">
const props = defineProps<{
  journeyId: string
  sectionId: string
  photos: Array<{ id: string; storageKeyThumb: string | null; capturedAt: string | null }>
}>()

const PROMINENT_COUNT = 3

const shown = computed(() => props.photos.slice(0, PROMINENT_COUNT))
const overflowCount = computed(() => Math.max(0, props.photos.length - PROMINENT_COUNT))

function photoUrl(id: string) {
  return `/journeys/${props.journeyId}/gallery?photo=${id}`
}
function sectionUrl() {
  return `/journeys/${props.journeyId}/gallery?section=${props.sectionId}`
}
</script>

<template>
  <div v-if="photos.length" class="grid grid-cols-4 gap-2">
    <NuxtLink
      v-for="photo in shown"
      :key="photo.id"
      :to="photoUrl(photo.id)"
      class="aspect-square overflow-hidden rounded-lg bg-(--color-paper)"
    >
      <img
        v-if="photo.storageKeyThumb"
        :src="`/api/files/${encodeURIComponent(photo.storageKeyThumb)}`"
        class="h-full w-full object-cover"
        loading="lazy"
        :alt="photo.capturedAt ?? 'photo'"
      />
    </NuxtLink>
    <NuxtLink
      v-if="overflowCount > 0"
      :to="sectionUrl()"
      class="flex aspect-square items-center justify-center rounded-lg bg-(--color-ink)/85 text-lg font-medium text-(--color-paper) transition hover:bg-(--color-ink)"
    >
      +{{ overflowCount }}
    </NuxtLink>
  </div>
</template>
