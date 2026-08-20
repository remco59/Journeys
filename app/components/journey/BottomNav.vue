<script setup lang="ts">
const props = defineProps<{ active: 'trip' | 'map' | 'story' | 'edit' | 'gallery' }>()

const linkBase = useLinkBase()
const readonly = useReadonly()

const TABS = [
  { key: 'trip', label: 'Trip' },
  { key: 'map', label: 'Map' },
  { key: 'story', label: 'Story' },
  { key: 'edit', label: 'Edit' }
] as const

const visibleTabs = computed(() => (readonly ? TABS.filter((t) => t.key !== 'edit') : TABS))

function pathFor(key: string) {
  return key === 'trip' ? linkBase : `${linkBase}/${key}`
}
</script>

<template>
  <nav
    v-if="active !== 'gallery'"
    class="fixed inset-x-3 z-40 mx-auto flex w-fit gap-1 rounded-2xl bg-(--color-canvas)/94 p-1.5 shadow-lg shadow-black/25 backdrop-blur-md md:gap-1.5 md:rounded-full md:p-2"
    style="bottom: max(0.75rem, env(safe-area-inset-bottom))"
  >
    <NuxtLink
      v-for="tab in visibleTabs"
      :key="tab.key"
      :to="pathFor(tab.key)"
      class="flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-medium transition md:flex-row md:gap-2 md:rounded-full md:px-5 md:py-2.5 md:text-sm"
      :class="active === tab.key ? 'text-(--color-gold)' : 'text-(--color-cream)/55 hover:text-(--color-cream)/80'"
    >
      <svg v-if="tab.key === 'trip'" class="h-[19px] w-[19px] md:h-[17px] md:w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" />
      </svg>
      <svg v-else-if="tab.key === 'map'" class="h-[19px] w-[19px] md:h-[17px] md:w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 20l-6-2V4l6 2m0 14l6-2m-6 2V6m6 12l6 2V6l-6-2m0 16V4m0 2L9 4" />
      </svg>
      <svg v-else-if="tab.key === 'story'" class="h-[19px] w-[19px] md:h-[17px] md:w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15.5a1 1 0 01-1 1H6.5A2.5 2.5 0 014 17V5.5z" /><path d="M4 17.5A2.5 2.5 0 016.5 15H20" />
      </svg>
      <svg v-else class="h-[19px] w-[19px] md:h-[17px] md:w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
