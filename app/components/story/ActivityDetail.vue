<script setup lang="ts">
type Photo = { id: string; storageKeyThumb: string | null; storageKeyPreview: string | null }

const props = defineProps<{
  activity: {
    id: string
    title: string
    type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
    startedAt: string
    endedAt: string
    distanceM: number | null
    elevationGainM: number | null
    avgSpeedMps?: number | null
    coverPhotoId?: string | null
    geom?: { type: 'LineString'; coordinates: [number, number][] } | null
  }
  photos: Photo[]
}>()

const filesBase = useFilesBase()
const linkBase = useLinkBase()

const TYPE_LABEL: Record<string, string> = {
  cycling: 'Cycling',
  hiking: 'Hiking',
  running: 'Running',
  walking: 'Walking',
  swimming: 'Swimming',
  other: 'Activity'
}

const coverPhoto = computed(() => props.photos.find((p) => p.id === props.activity.coverPhotoId) ?? null)
const coverUrl = computed(() => {
  const key = coverPhoto.value?.storageKeyPreview ?? coverPhoto.value?.storageKeyThumb
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
})

const durationLabel = computed(() => {
  const ms = new Date(props.activity.endedAt).getTime() - new Date(props.activity.startedAt).getTime()
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

const distanceLabel = computed(() => (props.activity.distanceM != null ? `${(props.activity.distanceM / 1000).toFixed(1)} km` : null))
const speedLabel = computed(() => (props.activity.avgSpeedMps != null ? `${(props.activity.avgSpeedMps * 3.6).toFixed(1)} km/h` : null))
const elevationLabel = computed(() =>
  props.activity.elevationGainM != null ? `${Math.round(props.activity.elevationGainM).toLocaleString()} m elevation gain` : null
)
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-(--color-activity)/30 bg-(--color-activity-soft)">
    <img v-if="coverUrl" :src="coverUrl" class="h-48 w-full object-cover" :alt="activity.title" />

    <div class="p-5">
      <p class="eyebrow text-(--color-activity)">{{ TYPE_LABEL[activity.type] }}</p>
      <p class="mt-1 font-(family-name:--font-display) text-lg font-medium">{{ activity.title }}</p>
      <p class="mt-2 flex flex-wrap gap-x-4 font-mono text-sm text-(--color-ink)">
        <span v-if="distanceLabel">{{ distanceLabel }}</span>
        <span v-if="speedLabel">{{ speedLabel }} avg</span>
        <span>{{ durationLabel }}</span>
        <span v-if="elevationLabel">{{ elevationLabel }}</span>
      </p>

      <ClientOnly v-if="activity.geom">
        <StoryActivityRouteMap class="mt-4" :geom="activity.geom" />
      </ClientOnly>

      <NuxtLink :to="`${linkBase}/map`" class="mt-3 inline-block text-xs text-(--color-ink-soft) hover:text-(--color-ink)">
        View full route →
      </NuxtLink>
    </div>
  </div>
</template>
