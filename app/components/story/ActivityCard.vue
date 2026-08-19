<script setup lang="ts">
const props = defineProps<{
  activity: {
    id: string
    title: string
    type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
    startedAt: string
    endedAt: string
    distanceM: number | null
    elevationGainM: number | null
  }
}>()

const emit = defineEmits<{ locate: [] }>()

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
  <button
    class="block w-full rounded-2xl border border-(--color-pine)/30 bg-(--color-pine)/[0.06] p-5 text-left transition hover:border-(--color-pine)/60"
    @click="emit('locate')"
  >
    <p class="font-(family-name:--font-display) text-lg font-medium text-(--color-pine)">{{ TYPE_LABEL[activity.type] }}</p>
    <p class="mt-0.5 text-sm text-(--color-ink-soft)">{{ activity.title }}</p>
    <p class="mt-2 flex flex-wrap gap-x-4 text-sm text-(--color-ink)">
      <span v-if="distanceLabel">{{ distanceLabel }}</span>
      <span>{{ durationLabel }}</span>
      <span v-if="elevationLabel">{{ elevationLabel }}</span>
    </p>
  </button>
</template>
