<script setup lang="ts">
type Photo = {
  id: string
  sectionId: string | null
  storageKeyOriginal?: string | null
  storageKeyThumb: string | null
  storageKeyPreview: string | null
  capturedAt: string | null
  caption: string | null
  cameraMake?: string | null
  cameraModel?: string | null
  altitudeM?: number | null
  locationSource: string
  lat?: number | null
  lon?: number | null
}
type Section = { id: string; title: string }

const props = defineProps<{ sections: Section[]; photos: Photo[] }>()
const emit = defineEmits<{ refresh: [] }>()

const route = useRoute()
const router = useRouter()
const linkBase = useLinkBase()

const sectionTitleById = computed(() => Object.fromEntries(props.sections.map((s) => [s.id, s.title])))
const sectionOptions = computed(() => props.sections.map((s) => ({ id: s.id, title: s.title })))

const initialPhotoId = computed(() => {
  const photoQuery = route.query.photo
  if (typeof photoQuery === 'string') return photoQuery

  const sectionQuery = route.query.section
  if (typeof sectionQuery === 'string') {
    const found = props.photos.find((p) => p.sectionId === sectionQuery)
    if (found) return found.id
  }
  return props.photos[0]?.id ?? null
})

function close() {
  if (window.history.state?.back) router.back()
  else navigateTo(`${linkBase}/story`)
}

const photoEditor = ref<{ open: (p: any, point: { lat: number; lon: number } | null) => void } | null>(null)
function openEditPhoto(photo: Photo) {
  const point = photo.lat != null && photo.lon != null ? { lat: photo.lat, lon: photo.lon } : null
  photoEditor.value?.open(photo, point)
}
function onPhotoChanged() {
  emit('refresh')
}
</script>

<template>
  <div>
    <PhotoGallery
      v-if="initialPhotoId"
      :photos="photos"
      :initial-photo-id="initialPhotoId"
      :section-title-by-id="sectionTitleById"
      @close="close"
      @edit="openEditPhoto"
    />
    <div v-else class="flex min-h-screen items-center justify-center px-6 text-center text-sm text-(--color-ink-soft)">
      No photos yet.
    </div>

    <ClientOnly>
      <PhotoEditorDialog ref="photoEditor" :sections="sectionOptions" @saved="onPhotoChanged" @deleted="onPhotoChanged" />
    </ClientOnly>
  </div>
</template>
