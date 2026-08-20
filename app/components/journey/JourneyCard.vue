<script setup lang="ts">
const props = defineProps<{
  journey: {
    id: string
    title: string
    startDate: string
    endDate: string
    updatedAt: string
    sectionsCount: number
    cover: { storageKeyPreview: string | null; storageKeyThumb: string | null } | null
  }
}>()
const emit = defineEmits<{ deleted: [id: string] }>()

const filesBase = useFilesBase()
const linkBase = useLinkBase()

const coverUrl = computed(() => {
  const key = props.journey.cover?.storageKeyPreview ?? props.journey.cover?.storageKeyThumb
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
})

const monthYear = computed(() => journeyMonthYearLabel(props.journey.startDate).toUpperCase())
const durationDays = computed(() => journeyDurationDays(props.journey.startDate, props.journey.endDate))
const updated = computed(() => timeAgo(props.journey.updatedAt))

const confirmDialog = ref<{ open: () => void } | null>(null)
const deleting = ref(false)

async function onConfirmDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/journeys/${props.journey.id}`, { method: 'DELETE' })
    emit('deleted', props.journey.id)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="relative">
    <NuxtLink
      :to="`${linkBase}/${journey.id}`"
      class="group block aspect-[2.3/1] w-full overflow-hidden rounded-[26px] bg-(--color-canvas) shadow-[0_8px_24px_rgba(20,26,32,0.12)] transition duration-200 ease-out active:scale-[0.98] sm:hover:shadow-[0_18px_40px_rgba(20,26,32,0.22)]"
    >
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="journey.title"
        class="h-full w-full object-cover brightness-[0.88] transition duration-300 ease-out sm:group-hover:scale-[1.04]"
      />
      <div v-else class="h-full w-full bg-gradient-to-br from-(--color-teal)/60 to-(--color-gold)/40" />

      <div class="pointer-events-none absolute inset-0 scrim-bottom" />

      <div class="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <p class="eyebrow text-(--color-gold)">{{ monthYear }}</p>
        <h3
          class="mt-1 line-clamp-2 font-(family-name:--font-display) text-2xl font-medium leading-[1.1] text-(--color-cream) sm:text-3xl"
        >
          {{ journey.title }}
        </h3>
        <p class="mt-2 font-mono text-xs text-(--color-cream)/80 sm:text-sm">
          <span>{{ durationDays }} day{{ durationDays === 1 ? '' : 's' }}</span>
          <template v-if="journey.sectionsCount">
            <span class="text-(--color-cream)/50"> · </span>
            <span>{{ journey.sectionsCount }} place{{ journey.sectionsCount === 1 ? '' : 's' }}</span>
          </template>
          <span class="text-(--color-cream)/50"> · </span>
          <span>{{ updated }}</span>
        </p>
      </div>
    </NuxtLink>

    <button
      type="button"
      class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-(--color-canvas)/45 text-(--color-cream) backdrop-blur transition hover:bg-(--color-canvas)/65 disabled:opacity-50"
      aria-label="Delete journey"
      :disabled="deleting"
      @click.stop.prevent="confirmDialog?.open()"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>

    <ConfirmDialog
      ref="confirmDialog"
      title="Delete this journey?"
      :message="`“${journey.title}” and all its photos, sections, and activities will be permanently deleted. This can't be undone.`"
      confirm-label="Delete journey"
      destructive
      @confirm="onConfirmDelete"
    />
  </div>
</template>
