<script setup lang="ts">
type Photo = {
  id: string
  storageKeyPreview: string | null
  storageKeyThumb: string | null
  capturedAt: string | null
  caption: string | null
  cameraMake: string | null
  cameraModel: string | null
  sectionId: string | null
}

const props = defineProps<{
  photos: Photo[]
  photoId: string | null
  sectionTitleById: Record<string, string>
}>()

const emit = defineEmits<{ 'update:photoId': [id: string | null] }>()

const index = computed(() => props.photos.findIndex((p) => p.id === props.photoId))
const current = computed(() => (index.value >= 0 ? props.photos[index.value] : null))

function close() {
  emit('update:photoId', null)
}
function prev() {
  if (index.value > 0) emit('update:photoId', props.photos[index.value - 1]!.id)
}
function next() {
  if (index.value >= 0 && index.value < props.photos.length - 1) emit('update:photoId', props.photos[index.value + 1]!.id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const dateLabel = computed(() => {
  if (!current.value?.capturedAt) return null
  return new Date(current.value.capturedAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})
const sectionTitle = computed(() => (current.value?.sectionId ? props.sectionTitleById[current.value.sectionId] : null))
const cameraLabel = computed(() => {
  const p = current.value
  if (!p) return null
  return [p.cameraMake, p.cameraModel].filter(Boolean).join(' ') || null
})
</script>

<template>
  <div
    v-if="current"
    class="fixed inset-0 z-50 flex flex-col bg-black/95"
    @click.self="close"
  >
    <button class="absolute right-4 top-4 z-10 text-2xl text-white/80 hover:text-white" @click="close">✕</button>
    <button
      v-if="index > 0"
      class="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-4 text-xl text-white hover:bg-white/20"
      @click="prev"
    >
      ‹
    </button>
    <button
      v-if="index < photos.length - 1"
      class="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-4 text-xl text-white hover:bg-white/20"
      @click="next"
    >
      ›
    </button>

    <div class="flex flex-1 items-center justify-center overflow-hidden p-4 pb-0">
      <img
        v-if="current.storageKeyPreview || current.storageKeyThumb"
        :src="`/api/files/${encodeURIComponent(current.storageKeyPreview ?? current.storageKeyThumb!)}`"
        class="max-h-full max-w-full object-contain"
        :alt="current.caption ?? dateLabel ?? 'photo'"
      />
    </div>

    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-4 text-center text-sm text-white/70">
      <span v-if="dateLabel">{{ dateLabel }}</span>
      <span v-if="sectionTitle">📍 {{ sectionTitle }}</span>
      <span v-if="cameraLabel">{{ cameraLabel }}</span>
      <span v-if="current.caption">{{ current.caption }}</span>
    </div>
  </div>
</template>
