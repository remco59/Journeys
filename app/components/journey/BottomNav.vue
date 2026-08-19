<script setup lang="ts">
const props = defineProps<{ active: 'trip' | 'map' | 'story' | 'gallery' }>()

const linkBase = useLinkBase()

const TABS: Array<{ key: 'trip' | 'map' | 'story' | 'gallery'; label: string }> = [
  { key: 'trip', label: 'Trip' },
  { key: 'map', label: 'Map' },
  { key: 'story', label: 'Story' },
  { key: 'gallery', label: 'Gallery' }
]

function pathFor(key: string) {
  return key === 'trip' ? linkBase : `${linkBase}/${key}`
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit gap-1 rounded-full border border-(--color-line) bg-(--color-paper-raised)/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.key"
      :to="pathFor(tab.key)"
      class="rounded-full px-4 py-2 text-sm transition"
      :class="active === tab.key ? 'bg-(--color-ink) text-(--color-paper)' : 'text-(--color-ink-soft) hover:text-(--color-ink)'"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
