<script setup lang="ts">
type Journey = { title: string; description: string | null; startDate: string; endDate: string; coverPhotoId: string | null }
type Section = {
  id: string
  title: string
  arrivalAt: string | null
  confidence: 'high' | 'medium' | 'low' | 'inferred'
}
type Photo = { id: string; sectionId: string | null; storageKeyThumb: string | null; storageKeyPreview: string | null }
type Trace = { distanceM: number | null }

const props = defineProps<{
  journey: Journey
  sections: Section[]
  photos: Photo[]
  traces: Trace[]
}>()

const photosBySection = computed(() => {
  const map = new Map<string | null, Photo[]>()
  for (const photo of props.photos) {
    const key = photo.sectionId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(photo)
  }
  return map
})

const totalDistanceM = computed(() => props.traces.reduce((sum, t) => sum + (t.distanceM ?? 0), 0))
</script>

<template>
  <div>
    <JourneyHero :journey="journey" :sections="sections" :photos="photos" :total-distance-m="totalDistanceM" />
    <JourneyTimeline :sections="sections" :photos-by-section="photosBySection" />
  </div>
</template>
