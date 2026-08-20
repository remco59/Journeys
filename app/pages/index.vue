<script setup lang="ts">
type JourneySummary = {
  id: string
  title: string
  startDate: string
  endDate: string
  updatedAt: string
  sectionsCount: number
  cover: { storageKeyPreview: string | null; storageKeyThumb: string | null } | null
}

const { data: journeys, pending, refresh } = await useFetch<JourneySummary[]>('/api/journeys')

const createDialog = ref<{ open: () => void } | null>(null)

function onDeleted(id: string) {
  if (journeys.value) journeys.value = journeys.value.filter((j) => j.id !== id)
}
</script>

<template>
  <div class="min-h-screen bg-(--color-paper)">
    <div class="mx-auto flex max-w-6xl items-center justify-end gap-3 px-6 pt-6 sm:px-10">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--color-teal) text-(--color-cream) shadow-[0_4px_12px_rgba(31,67,63,0.32)] transition hover:bg-(--color-teal-deep)"
        aria-label="Create journey"
        @click="createDialog?.open()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <JourneyAccountMenu />
    </div>

    <header class="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6 pb-8 pt-1 sm:px-10 sm:pb-10">
      <div>
        <p class="eyebrow text-(--color-gold)">Your journals</p>
        <h1 class="mt-2 font-(family-name:--font-display) text-4xl font-medium leading-none text-(--color-ink) sm:text-5xl">
          Journeys
        </h1>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
      <div v-if="pending && !journeys?.length" class="grid grid-cols-1 gap-6 sm:gap-7 md:grid-cols-2 2xl:grid-cols-3">
        <div v-for="n in 3" :key="n" class="aspect-[2.3/1] w-full animate-pulse-soft rounded-[26px] bg-(--color-paper-raised)" />
      </div>

      <JourneyEmptyJourneys v-else-if="!journeys?.length" @create="createDialog?.open()" />

      <div v-else class="grid grid-cols-1 gap-6 sm:gap-7 md:grid-cols-2 2xl:grid-cols-3">
        <JourneyCard
          v-for="(journey, i) in journeys"
          :key="journey.id"
          class="animate-fade-up"
          :style="{ animationDelay: `${Math.min(i, 8) * 60}ms` }"
          :journey="journey"
          @deleted="onDeleted"
        />
      </div>
    </main>

    <ClientOnly>
      <JourneyCreateJourneyDialog ref="createDialog" @created="refresh" />
    </ClientOnly>
  </div>
</template>
