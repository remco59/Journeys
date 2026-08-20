<script setup lang="ts">
type Section = {
  id: string
  title: string
  arrivalAt: string
  confidence: 'high' | 'medium' | 'low' | 'inferred'
}

const props = defineProps<{
  section: Section
  photoCount: number
  thumbUrl: string | null
  isLast: boolean
}>()

const linkBase = useLinkBase()

const CONNECTOR_CLASS: Record<string, string> = {
  high: 'border-(--color-teal)',
  medium: 'border-(--color-gold)',
  low: 'border-(--color-stone-line)',
  inferred: 'border-(--color-stone-line)'
}
const CONNECTOR_STYLE: Record<string, string> = {
  high: 'solid',
  medium: 'dashed',
  low: 'dotted',
  inferred: 'dotted'
}

const dateLabel = computed(() => formatDayMonth(props.section.arrivalAt))
const connectorBorderStyle = computed(() => CONNECTOR_STYLE[props.section.confidence] ?? 'dotted')
</script>

<template>
  <NuxtLink :to="`${linkBase}/story?section=${section.id}`" class="group flex gap-4">
    <div class="flex flex-col items-center">
      <span class="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-(--color-teal) bg-(--color-paper)" />
      <span
        v-if="!isLast"
        class="mt-1 w-0 flex-1 border-l-2"
        :class="CONNECTOR_CLASS[section.confidence] ?? 'border-(--color-stone-line)'"
        :style="`border-left-style: ${connectorBorderStyle}`"
      />
    </div>

    <div class="flex flex-1 items-center gap-3 pb-7">
      <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-(--color-paper-raised)">
        <img v-if="thumbUrl" :src="thumbUrl" class="h-full w-full object-cover" loading="lazy" :alt="section.title" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-(family-name:--font-display) text-xl font-medium text-(--color-ink)">{{ section.title }}</p>
        <p class="mt-0.5 font-mono text-xs text-(--color-ink-soft)">
          {{ dateLabel }} ·
          {{ photoCount }} photo{{ photoCount === 1 ? '' : 's' }}
        </p>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0 text-(--color-ink-soft)/50 transition group-hover:text-(--color-ink-soft)"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </div>
  </NuxtLink>
</template>
