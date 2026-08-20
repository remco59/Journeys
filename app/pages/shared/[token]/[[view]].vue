<script setup lang="ts">
// Nuxt keys <NuxtPage> by the interpolated route path by default, so without
// this the whole page (BottomNav included) would remount — and replay the
// outer page transition — on every tab switch, not just real navigations.
definePageMeta({ key: (route) => route.params.token as string })

const route = useRoute()
const token = route.params.token as string
const activeView = computed(() => {
  const v = route.params.view
  const key = Array.isArray(v) ? v[0] : v
  return (key || 'trip') as 'trip' | 'map' | 'story' | 'gallery'
})

const TAB_ORDER = ['trip', 'map', 'story'] as const
const viewTransition = ref('view-fade')
watch(activeView, (next, prev) => {
  const a = TAB_ORDER.indexOf(prev as (typeof TAB_ORDER)[number])
  const b = TAB_ORDER.indexOf(next as (typeof TAB_ORDER)[number])
  viewTransition.value = a === -1 || b === -1 ? 'view-fade' : b > a ? 'view-slide-left' : 'view-slide-right'
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

// A shared viewer has nothing to Share or Add — the actions exist only so
// nested components (JourneyHero) can call useJourneyActions() unconditionally.
provideJourneyActions({ openShare: () => {}, openAddSheet: () => {} })
</script>

<template>
  <div v-if="journey" class="min-h-screen bg-(--color-paper)">
    <Transition :name="viewTransition" mode="out-in">
      <JourneyPanelsTripPanel v-if="activeView === 'trip'" :journey="journey" :sections="sections ?? []" :photos="photos ?? []" :traces="traces ?? []" />

      <div v-else-if="activeView === 'map'">
        <ClientOnly>
          <JourneyPanelsMapPanel :sections="sections ?? []" :traces="traces ?? []" :photos="photos ?? []" />
        </ClientOnly>
      </div>

      <JourneyPanelsStoryPanel
        v-else-if="activeView === 'story'"
        :journey="journey"
        :sections="sections ?? []"
        :photos="photos ?? []"
        :activities="activities ?? []"
      />

      <JourneyPanelsGalleryPanel v-else-if="activeView === 'gallery'" :sections="sections ?? []" :photos="photos ?? []" />
    </Transition>

    <JourneyBottomNav :active="activeView" />
  </div>
</template>
