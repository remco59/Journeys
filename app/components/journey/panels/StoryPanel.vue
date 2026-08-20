<script setup lang="ts">
type SectionSummary = {
  id: string
  title: string
  placeName: string | null
  description: string | null
}

const props = defineProps<{
  journey: { title: string }
  sections: Array<
    SectionSummary & {
      arrivalAt: string
      departureAt: string | null
      confidence: 'high' | 'medium' | 'low' | 'inferred'
    }
  >
  photos: Array<{
    id: string
    sectionId: string | null
    storageKeyThumb: string | null
    storageKeyPreview: string | null
    capturedAt: string | null
    showInStory?: boolean
  }>
  activities: Array<{
    id: string
    title: string
    type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
    startedAt: string
    endedAt: string
    distanceM: number | null
    elevationGainM: number | null
    avgSpeedMps?: number | null
    coverPhotoId?: string | null
    geom?: { type: 'LineString'; coordinates: [number, number][] } | null
  }>
}>()

const route = useRoute()
const readonly = useReadonly()

const photosBySection = computed(() => {
  const map = new Map<string | null, typeof props.photos>()
  for (const photo of props.photos) {
    const key = photo.sectionId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }
  return map
})

// Sections stay in their manually-set order (props.sections is already sorted
// by arrivalAt); activities are interleaved into the gaps between sections by time.
type StoryItem =
  | { kind: 'section'; section: (typeof props.sections)[number] }
  | { kind: 'activity'; activity: (typeof props.activities)[number] }

const storyItems = computed<StoryItem[]>(() => {
  const activities = [...props.activities].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
  let activityIndex = 0
  const items: StoryItem[] = []

  for (const section of props.sections) {
    const arrivalTime = new Date(section.arrivalAt).getTime()
    while (activityIndex < activities.length && new Date(activities[activityIndex]!.startedAt).getTime() < arrivalTime) {
      items.push({ kind: 'activity', activity: activities[activityIndex]! })
      activityIndex++
    }
    items.push({ kind: 'section', section })
  }
  while (activityIndex < activities.length) {
    items.push({ kind: 'activity', activity: activities[activityIndex]! })
    activityIndex++
  }

  return items
})

onMounted(async () => {
  const sectionId = route.query.section
  if (typeof sectionId !== 'string') return
  await nextTick()
  document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 pt-8 pb-nav-safe">
    <JourneyBackButton v-if="!readonly" class="mb-4" />
    <p class="eyebrow text-(--color-stone)">Story</p>
    <h1 class="mt-1 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">{{ journey.title }}</h1>

    <div v-if="storyItems.length" class="mt-10 space-y-14">
      <template v-for="item in storyItems" :key="item.kind + (item.kind === 'section' ? item.section.id : item.activity.id)">
        <StorySection v-if="item.kind === 'section'" :section="item.section" :photos="photosBySection.get(item.section.id) ?? []" />
        <StoryActivityDetail v-else :activity="item.activity" :photos="photos" />
      </template>
    </div>
    <p v-else class="mt-10 text-sm text-(--color-ink-soft)">
      Nothing here yet — head to Edit to add photos and your story will build itself.
    </p>
  </div>
</template>
