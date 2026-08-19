<script setup lang="ts">
type Photo = {
  id: string
  sectionId: string | null
  storageKeyThumb: string | null
  storageKeyPreview: string | null
  capturedAt: string | null
  caption: string | null
  cameraMake: string | null
  cameraModel: string | null
  locationSource: string
}
type Section = { id: string; title: string; placeName: string | null; arrivalAt: string | null }

const props = defineProps<{ sections: Section[]; photos: Photo[] }>()

const route = useRoute()

const groups = computed(() => {
  const bySection = new Map<string | null, Photo[]>()
  for (const photo of props.photos) {
    const key = photo.sectionId
    if (!bySection.has(key)) bySection.set(key, [])
    bySection.get(key)!.push(photo)
  }

  const ordered: Array<{ key: string; title: string; subtitle: string | null; photos: Photo[] }> = []
  for (const section of props.sections) {
    const sectionPhotos = bySection.get(section.id)
    if (!sectionPhotos?.length) continue
    ordered.push({ key: section.id, title: section.title, subtitle: section.placeName, photos: sectionPhotos })
  }
  const unsorted = bySection.get(null)
  if (unsorted?.length) {
    ordered.push({ key: 'unsorted', title: 'Unsorted', subtitle: null, photos: unsorted })
  }
  return ordered
})

const sectionTitleById = computed(() =>
  Object.fromEntries(props.sections.map((s) => [s.id, s.title]))
)

const lightboxPhotoId = ref<string | null>(null)
const groupRefs = ref<Record<string, HTMLElement | null>>({})

onMounted(async () => {
  const photoQuery = route.query.photo
  if (typeof photoQuery === 'string') {
    lightboxPhotoId.value = photoQuery
    return
  }
  const sectionQuery = route.query.section
  if (typeof sectionQuery === 'string') {
    await nextTick()
    groupRefs.value[sectionQuery]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10">
    <div v-if="groups.length" class="space-y-10">
      <section v-for="group in groups" :key="group.key" :ref="(el) => (groupRefs[group.key] = el as HTMLElement)">
        <h3 class="mb-3 font-(family-name:--font-display) text-lg font-medium">
          {{ group.title }}
          <span v-if="group.subtitle" class="ml-1 text-sm font-normal text-(--color-ink-soft)">📍 {{ group.subtitle }}</span>
        </h3>
        <PhotoMasonryGrid :photos="group.photos" @select="lightboxPhotoId = $event" />
      </section>
    </div>
    <p v-else class="text-sm text-(--color-ink-soft)">No photos yet.</p>

    <PhotoLightbox v-model:photo-id="lightboxPhotoId" :photos="photos" :section-title-by-id="sectionTitleById" />
  </div>
</template>
