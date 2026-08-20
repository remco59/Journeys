<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

type Journey = { title: string; description: string | null; startDate: string; endDate: string; coverPhotoId: string | null }
type Photo = { id: string; storageKeyPreview: string | null; storageKeyThumb: string | null }

const props = defineProps<{
  journey: Journey
  sections: Array<{ id: string }>
  photos: Photo[]
  totalDistanceM: number
}>()

const filesBase = useFilesBase()
const readonly = useReadonly()
const actions = useJourneyActions()
const auth = useAuthStore()

const coverPhoto = computed(() => {
  const byId = props.journey.coverPhotoId ? props.photos.find((p) => p.id === props.journey.coverPhotoId) : null
  return byId ?? props.photos[0] ?? null
})
const coverUrl = computed(() => {
  const key = coverPhoto.value?.storageKeyPreview ?? coverPhoto.value?.storageKeyThumb
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
})

const durationDays = computed(() => journeyDurationDays(props.journey.startDate, props.journey.endDate))
const monthYear = computed(() => journeyMonthYearLabel(props.journey.startDate).toUpperCase())
const placesCount = computed(() => props.sections.length)
const distanceLabel = computed(() =>
  props.totalDistanceM > 0 ? `≈${formatDistance(props.totalDistanceM, auth.user?.distanceUnit ?? 'km')}` : null
)
</script>

<template>
  <div class="relative h-[62vh] min-h-[420px] w-full overflow-hidden bg-(--color-canvas)">
    <img v-if="coverUrl" :src="coverUrl" class="absolute inset-0 h-full w-full object-cover" :alt="journey.title" />
    <div v-else class="absolute inset-0 bg-gradient-to-br from-(--color-teal)/50 to-(--color-gold)/40" />

    <div class="absolute inset-0 scrim-top" />
    <div class="absolute inset-0 scrim-bottom" />

    <div class="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <JourneyBackButton v-if="!readonly" />
      <span v-else class="dark-pill">Shared journey · read only</span>

      <div v-if="!readonly" class="flex gap-2">
        <button class="icon-btn" aria-label="Share journey" @click="actions.openShare()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
          </svg>
        </button>
        <button class="icon-btn" aria-label="Add photos or import" @click="actions.openAddSheet()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>

    <div class="absolute inset-x-0 bottom-0 p-6 pb-8">
      <p class="eyebrow text-(--color-gold)">{{ monthYear }}</p>
      <h1 class="mt-1 font-(family-name:--font-display) text-4xl font-medium leading-[1.05] text-(--color-cream) sm:text-5xl">
        {{ journey.title }}
      </h1>
      <p v-if="journey.description" class="mt-2 max-w-prose text-sm text-(--color-cream)/80">{{ journey.description }}</p>
      <p class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-(--color-cream)/80">
        <span>{{ durationDays }} day{{ durationDays === 1 ? '' : 's' }}</span>
        <span v-if="placesCount" class="text-(--color-cream)/40">·</span>
        <span v-if="placesCount">{{ placesCount }} place{{ placesCount === 1 ? '' : 's' }}</span>
        <span v-if="distanceLabel" class="text-(--color-cream)/40">·</span>
        <span v-if="distanceLabel">{{ distanceLabel }}</span>
      </p>
    </div>
  </div>
</template>
