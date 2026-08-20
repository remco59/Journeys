<script setup lang="ts">
// Nuxt keys <NuxtPage> by the interpolated route path by default, so without
// this the whole page (BottomNav included) would remount — and replay the
// outer page transition — on every tab switch, not just real navigations.
definePageMeta({ key: (route) => route.params.id as string })

const route = useRoute()
const id = route.params.id as string
const activeView = computed(() => {
  const v = route.params.view
  const key = Array.isArray(v) ? v[0] : v
  return (key || 'trip') as 'trip' | 'map' | 'story' | 'edit' | 'gallery'
})

const TAB_ORDER = ['trip', 'map', 'story', 'edit'] as const
const viewTransition = ref('view-fade')
watch(activeView, (next, prev) => {
  const a = TAB_ORDER.indexOf(prev as (typeof TAB_ORDER)[number])
  const b = TAB_ORDER.indexOf(next as (typeof TAB_ORDER)[number])
  viewTransition.value = a === -1 || b === -1 ? 'view-fade' : b > a ? 'view-slide-left' : 'view-slide-right'
})

provideJourneyContext({ filesBase: '/api/files', linkBase: `/journeys/${id}`, readonly: false })

const { data: journey, refresh: refreshJourney } = await useFetch(`/api/journeys/${id}`)
if (!journey.value) {
  throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
}

const { data: photos, refresh: refreshPhotos } = await useFetch(`/api/journeys/${id}/photos`)
const { data: sections, refresh: refreshSections } = await useFetch(`/api/journeys/${id}/sections`)
const { data: traces, refresh: refreshTraces } = await useFetch(`/api/journeys/${id}/traces`)
const { data: activities, refresh: refreshActivities } = await useFetch(`/api/journeys/${id}/activities`)

async function refreshAll() {
  await Promise.all([refreshJourney(), refreshPhotos(), refreshSections(), refreshTraces(), refreshActivities()])
}

async function onEditTrace(traceId: string, transportMode: string) {
  await $fetch(`/api/traces/${traceId}`, { method: 'PATCH', body: { transportMode } })
  await refreshTraces()
}

const shareDialog = ref<{ open: () => void } | null>(null)
const addSheet = ref<{ open: (mode?: 'photos' | 'activity' | 'timeline' | 'section') => void } | null>(null)

provideJourneyActions({
  openShare: () => shareDialog.value?.open(),
  openAddSheet: (mode) => addSheet.value?.open(mode)
})
</script>

<template>
  <div v-if="journey" class="min-h-screen bg-(--color-paper)">
    <Transition :name="viewTransition" mode="out-in">
      <JourneyPanelsTripPanel v-if="activeView === 'trip'" :journey="journey" :sections="sections ?? []" :photos="photos ?? []" :traces="traces ?? []" />

      <div v-else-if="activeView === 'map'">
        <ClientOnly>
          <JourneyPanelsMapPanel :sections="sections ?? []" :traces="traces ?? []" :photos="photos ?? []" @edit-trace="onEditTrace" />
        </ClientOnly>
      </div>

      <JourneyPanelsStoryPanel
        v-else-if="activeView === 'story'"
        :journey="journey"
        :sections="sections ?? []"
        :photos="photos ?? []"
        :activities="activities ?? []"
      />

      <JourneyPanelsEditPanel
        v-else-if="activeView === 'edit'"
        :journey-id="id"
        :journey="journey"
        :sections="sections ?? []"
        :photos="photos ?? []"
        :activities="activities ?? []"
        @refresh="refreshAll"
      />

      <JourneyPanelsGalleryPanel
        v-else-if="activeView === 'gallery'"
        :sections="sections ?? []"
        :photos="photos ?? []"
        @refresh="refreshAll"
      />
    </Transition>

    <JourneyBottomNav :active="activeView" />

    <ClientOnly>
      <JourneyShareDialog ref="shareDialog" :journey-id="id" />
      <JourneyAddJourneyContentSheet ref="addSheet" :journey-id="id" :photos="photos ?? []" @refresh="refreshAll" />
    </ClientOnly>
  </div>
</template>
