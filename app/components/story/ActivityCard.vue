<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    activity: {
      id: string
      title: string
      type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
      startedAt: string
      endedAt: string
      distanceM: number | null
      elevationGainM: number | null
    }
    hideEdit?: boolean
  }>(),
  { hideEdit: false }
)

const emit = defineEmits<{ locate: []; edit: [] }>()
const readonly = useReadonly()

const TYPE_LABEL: Record<string, string> = {
  cycling: 'Cycling',
  hiking: 'Hiking',
  running: 'Running',
  walking: 'Walking',
  swimming: 'Swimming',
  other: 'Activity'
}

const durationLabel = computed(() => {
  const ms = new Date(props.activity.endedAt).getTime() - new Date(props.activity.startedAt).getTime()
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

const distanceLabel = computed(() => (props.activity.distanceM != null ? `${(props.activity.distanceM / 1000).toFixed(1)} km` : null))
const elevationLabel = computed(() =>
  props.activity.elevationGainM != null ? `${Math.round(props.activity.elevationGainM).toLocaleString()} m elevation gain` : null
)
</script>

<template>
  <div class="relative rounded-2xl border border-(--color-activity)/30 bg-(--color-activity-soft) p-5 transition hover:border-(--color-activity)/60">
    <button class="block w-full text-left" @click="emit('locate')">
      <p class="eyebrow text-(--color-activity)">{{ TYPE_LABEL[activity.type] }}</p>
      <p class="mt-1 font-(family-name:--font-display) text-lg font-medium">{{ activity.title }}</p>
      <p class="mt-2 flex flex-wrap gap-x-4 font-mono text-sm text-(--color-ink)">
        <span v-if="distanceLabel">{{ distanceLabel }}</span>
        <span>{{ durationLabel }}</span>
        <span v-if="elevationLabel">{{ elevationLabel }}</span>
      </p>
    </button>
    <button
      v-if="!readonly && !hideEdit"
      type="button"
      class="absolute right-4 top-4 text-xs text-(--color-ink-soft) hover:text-(--color-ink)"
      @click.stop="emit('edit')"
    >
      Edit
    </button>
  </div>
</template>
