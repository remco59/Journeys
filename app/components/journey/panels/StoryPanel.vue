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
      arrivalAt: string | null
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
  }>
  activities: Array<{
    id: string
    title: string
    type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
    startedAt: string
    endedAt: string
    distanceM: number | null
    elevationGainM: number | null
  }>
}>()

const route = useRoute()
const linkBase = useLinkBase()
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

// Sections and activities interleaved chronologically: section -> movement -> section...
type StoryItem =
  | { kind: 'section'; time: number; section: (typeof props.sections)[number] }
  | { kind: 'activity'; time: number; activity: (typeof props.activities)[number] }

const storyItems = computed<StoryItem[]>(() => {
  const timed: StoryItem[] = [
    ...props.sections
      .filter((s) => s.arrivalAt)
      .map((section) => ({ kind: 'section' as const, time: new Date(section.arrivalAt!).getTime(), section })),
    ...props.activities.map((activity) => ({ kind: 'activity' as const, time: new Date(activity.startedAt).getTime(), activity }))
  ].sort((a, b) => a.time - b.time)

  // Sections without a known arrival time (e.g. added by hand from the map,
  // before any timestamped photo pinned them to a moment) still need to
  // render — otherwise there's nothing for a map-click deep link to scroll to.
  const undated: StoryItem[] = props.sections.filter((s) => !s.arrivalAt).map((section) => ({ kind: 'section' as const, time: Infinity, section }))

  return [...timed, ...undated]
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
        <NuxtLink v-else :to="`${linkBase}/map`" class="block">
          <StoryActivityCard :activity="item.activity" hide-edit />
        </NuxtLink>
      </template>
    </div>
    <p v-else class="mt-10 text-sm text-(--color-ink-soft)">
      Nothing here yet — head to Edit to add photos and your story will build itself.
    </p>
  </div>
</template>
