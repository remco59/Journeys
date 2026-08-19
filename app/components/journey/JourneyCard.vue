<script setup lang="ts">
const props = defineProps<{
  journey: {
    id: string
    title: string
    startDate: string
    endDate: string
    coverPhotoId: string | null
  }
}>()

const monthYear = computed(() =>
  new Date(props.journey.startDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const durationDays = computed(() => {
  const start = new Date(props.journey.startDate)
  const end = new Date(props.journey.endDate)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
})
</script>

<template>
  <NuxtLink
    :to="`/journeys/${journey.id}`"
    class="group block overflow-hidden rounded-2xl border border-(--color-line) bg-(--color-paper-raised) transition hover:shadow-lg hover:shadow-black/5"
  >
    <div class="relative aspect-[4/3] w-full bg-gradient-to-br from-(--color-pine)/25 to-(--color-gold)/25">
      <div class="absolute inset-0 flex items-center justify-center text-(--color-ink-soft)/40">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M3 17l5-6 4 4 3-4 6 6" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      </div>
    </div>
    <div class="p-4">
      <h3 class="font-(family-name:--font-display) text-lg font-medium leading-tight text-(--color-ink)">
        {{ journey.title }}
      </h3>
      <p class="mt-1 text-sm text-(--color-ink-soft)">{{ monthYear }}</p>
      <p class="text-sm text-(--color-ink-soft)">{{ durationDays }} day{{ durationDays === 1 ? '' : 's' }}</p>
    </div>
  </NuxtLink>
</template>
