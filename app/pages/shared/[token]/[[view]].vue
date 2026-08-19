<script setup lang="ts">
const route = useRoute()
const token = route.params.token as string
const activeView = computed(() => {
  const v = route.params.view
  const key = Array.isArray(v) ? v[0] : v
  return (key ?? 'trip') as 'trip' | 'map' | 'story' | 'gallery'
})

provideJourneyContext({ filesBase: `/api/shared/${token}/files`, linkBase: `/shared/${token}`, readonly: true })

const { data: journey } = await useFetch(`/api/shared/${token}/journey`)
if (!journey.value) {
  throw createError({ statusCode: 404, statusMessage: 'This shared journey link is invalid or has been revoked.' })
}

const { data: photos } = await useFetch(`/api/shared/${token}/photos`)
const { data: sections } = await useFetch(`/api/shared/${token}/sections`)
const { data: traces } = await useFetch(`/api/shared/${token}/traces`)
const { data: activities } = await useFetch(`/api/shared/${token}/activities`)

const photosBySection = computed(() => {
  const map = new Map<string | null, NonNullable<typeof photos.value>>()
  for (const photo of photos.value ?? []) {
    const key = photo.sectionId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }
  return map
})

const durationDays = computed(() => {
  if (!journey.value) return 0
  const start = new Date(journey.value.startDate)
  const end = new Date(journey.value.endDate)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
})
</script>

<template>
  <div v-if="journey" class="min-h-screen bg-(--color-paper) pb-24">
    <header class="border-b border-(--color-line) bg-(--color-paper-raised)">
      <div class="mx-auto max-w-4xl px-6 py-6">
        <p class="text-xs uppercase tracking-wide text-(--color-ink-soft)">Shared journey · read only</p>
        <h1 class="mt-1 font-(family-name:--font-display) text-3xl font-medium">{{ journey.title }}</h1>
        <p class="mt-1 text-(--color-ink-soft)">
          {{ journey.startDate }} – {{ journey.endDate }} · {{ durationDays }} day{{ durationDays === 1 ? '' : 's' }}
        </p>
        <p v-if="journey.description" class="mt-3 max-w-2xl text-(--color-ink)">{{ journey.description }}</p>
      </div>
    </header>

    <main>
      <JourneyPanelsTripPanel v-if="activeView === 'trip'" :sections="sections ?? []" :photos-by-section="photosBySection" />
      <ClientOnly v-else-if="activeView === 'map'">
        <JourneyPanelsMapPanel :sections="sections ?? []" :traces="traces ?? []" :photos="photos ?? []" />
      </ClientOnly>
      <JourneyPanelsStoryPanel
        v-else-if="activeView === 'story'"
        journey-id=""
        :sections="sections ?? []"
        :photos="photos ?? []"
        :activities="activities ?? []"
      />
      <JourneyPanelsGalleryPanel v-else-if="activeView === 'gallery'" :sections="sections ?? []" :photos="photos ?? []" />
    </main>

    <JourneyBottomNav :active="activeView" />
  </div>
</template>
