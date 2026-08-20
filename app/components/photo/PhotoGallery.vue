<script setup lang="ts">
type Photo = {
  id: string
  storageKeyOriginal?: string | null
  storageKeyPreview: string | null
  storageKeyThumb: string | null
  capturedAt: string | null
  caption: string | null
  cameraMake?: string | null
  cameraModel?: string | null
  altitudeM?: number | null
  sectionId: string | null
  locationSource: string
  lat?: number | null
  lon?: number | null
}

const props = defineProps<{
  photos: Photo[]
  initialPhotoId: string
  sectionTitleById: Record<string, string>
}>()

const emit = defineEmits<{ close: []; edit: [photo: Photo] }>()
const filesBase = useFilesBase()
const readonly = useReadonly()

const currentId = ref(props.initialPhotoId)
watch(
  () => props.initialPhotoId,
  (id) => (currentId.value = id)
)

const index = computed(() => props.photos.findIndex((p) => p.id === currentId.value))
const current = computed(() => (index.value >= 0 ? props.photos[index.value] : null))
const zoomed = ref(false)
watch(currentId, () => (zoomed.value = false))

const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null
function stopSlideshow() {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}
function togglePlay() {
  if (isPlaying.value) {
    stopSlideshow()
    return
  }
  if (props.photos.length < 2) return
  isPlaying.value = true
  playTimer = setInterval(() => {
    const i = props.photos.findIndex((p) => p.id === currentId.value)
    currentId.value = i < 0 || i >= props.photos.length - 1 ? props.photos[0]!.id : props.photos[i + 1]!.id
  }, 4000)
}

function goTo(id: string) {
  stopSlideshow()
  currentId.value = id
}
function prev() {
  stopSlideshow()
  if (index.value > 0) currentId.value = props.photos[index.value - 1]!.id
}
function next() {
  stopSlideshow()
  if (index.value >= 0 && index.value < props.photos.length - 1) currentId.value = props.photos[index.value + 1]!.id
}
function toggleZoom() {
  zoomed.value = !zoomed.value
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
  if (e.key === ' ') {
    e.preventDefault()
    togglePlay()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopSlideshow()
})

let touchStartX = 0
let touchStartY = 0
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]!.clientX
  touchStartY = e.touches[0]!.clientY
}
function onTouchEnd(e: TouchEvent) {
  if (zoomed.value) return
  const dx = e.changedTouches[0]!.clientX - touchStartX
  const dy = e.changedTouches[0]!.clientY - touchStartY
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  if (dx < 0) next()
  else prev()
}

const imgWrap = ref<HTMLDivElement | null>(null)
let panActive = false
let panStartX = 0
let panStartY = 0
let panScrollLeft = 0
let panScrollTop = 0
function onPanStart(e: MouseEvent) {
  if (!zoomed.value || !imgWrap.value) return
  panActive = true
  panStartX = e.clientX
  panStartY = e.clientY
  panScrollLeft = imgWrap.value.scrollLeft
  panScrollTop = imgWrap.value.scrollTop
}
function onPanMove(e: MouseEvent) {
  if (!panActive || !imgWrap.value) return
  imgWrap.value.scrollLeft = panScrollLeft - (e.clientX - panStartX)
  imgWrap.value.scrollTop = panScrollTop - (e.clientY - panStartY)
}
function onPanEnd() {
  panActive = false
}

const thumbRefs = new Map<string, HTMLElement>()
function setThumbRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) thumbRefs.set(id, el)
  else thumbRefs.delete(id)
}
watch(currentId, (id) => {
  thumbRefs.get(id)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
})
onMounted(() => {
  thumbRefs.get(currentId.value)?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' })
})

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

function thumbUrl(p: Photo) {
  const key = p.storageKeyThumb ?? p.storageKeyPreview
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}
const downloadUrl = computed(() => {
  const p = current.value
  if (!p) return null
  const key = p.storageKeyOriginal ?? p.storageKeyPreview ?? p.storageKeyThumb
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
})
const downloadFilename = computed(() => {
  const p = current.value
  if (!p) return 'photo.jpg'
  const key = p.storageKeyOriginal ?? p.storageKeyPreview ?? p.storageKeyThumb ?? ''
  const ext = key.split('.').pop() || 'jpg'
  const base = (p.caption?.trim() || p.capturedAt?.slice(0, 10) || 'photo').replace(/[^\w-]+/g, '-').slice(0, 60)
  return `${base}.${ext}`
})

const infoDialog = ref<{ open: (p: Photo, section: string | null) => void } | null>(null)
function openInfo() {
  if (current.value) infoDialog.value?.open(current.value, sectionTitle.value ?? null)
}
</script>

<template>
  <div
    v-if="current"
    class="fixed inset-0 z-50 flex flex-col bg-(--color-canvas)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @click.self="emit('close')"
  >
    <div class="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <span v-if="sectionTitle" class="dark-pill">{{ sectionTitle }}</span>
      <span v-else />
      <div class="flex gap-2">
        <button v-if="photos.length > 1" class="icon-btn" :aria-label="isPlaying ? 'Pause slideshow' : 'Play slideshow'" @click="togglePlay">
          <svg v-if="!isPlaying" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        </button>
        <button class="icon-btn" aria-label="Photo details" @click="openInfo">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.01" />
          </svg>
        </button>
        <a v-if="downloadUrl" class="icon-btn" aria-label="Download" :href="downloadUrl" :download="downloadFilename" @click.stop>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </a>
        <button v-if="!readonly" class="icon-btn" @click="emit('edit', current)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button class="icon-btn" aria-label="Close" @click="emit('close')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <button v-if="index > 0" class="icon-btn absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 text-lg sm:flex" @click="prev">‹</button>
    <button v-if="index < photos.length - 1" class="icon-btn absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 text-lg sm:flex" @click="next">›</button>

    <div
      ref="imgWrap"
      class="relative flex flex-1 p-4 pb-0"
      :class="zoomed ? 'cursor-grab overflow-auto active:cursor-grabbing' : 'items-center justify-center overflow-hidden'"
      @mousedown="onPanStart"
      @mousemove="onPanMove"
      @mouseup="onPanEnd"
      @mouseleave="onPanEnd"
    >
      <Transition name="photo-fade" mode="out-in">
        <img
          v-if="current.storageKeyPreview || current.storageKeyThumb"
          :key="current.id"
          :src="`${filesBase}/${encodeURIComponent(current.storageKeyPreview ?? current.storageKeyThumb!)}`"
          class="rounded-2xl"
          :class="zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full object-contain cursor-zoom-in'"
          :alt="current.caption ?? dateLabel ?? 'photo'"
          @dblclick="toggleZoom"
        />
      </Transition>
    </div>

    <div class="flex flex-col items-center gap-1 p-4 pb-2 text-center">
      <p v-if="current.caption" class="max-w-md text-sm text-(--color-cream)/90">{{ current.caption }}</p>
      <p class="flex flex-wrap items-center justify-center gap-x-3 font-mono text-[11px] text-(--color-cream)/55">
        <span v-if="dateLabel">{{ dateLabel }}</span>
        <span v-if="cameraLabel">{{ cameraLabel }}</span>
        <span>{{ index + 1 }} / {{ photos.length }}</span>
      </p>
    </div>

    <div
      v-if="photos.length > 1"
      class="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <button
        v-for="p in photos"
        :key="p.id"
        :ref="(el) => setThumbRef(p.id, el)"
        type="button"
        class="h-14 w-14 shrink-0 overflow-hidden rounded-lg transition-opacity"
        :class="p.id === currentId ? 'opacity-100 ring-2 ring-(--color-cream)' : 'opacity-45 hover:opacity-75'"
        @click="goTo(p.id)"
      >
        <img
          v-if="thumbUrl(p)"
          :src="thumbUrl(p)!"
          class="h-full w-full object-cover"
          loading="lazy"
          :alt="p.caption ?? ''"
        />
      </button>
    </div>

    <ClientOnly>
      <PhotoInfoDialog ref="infoDialog" />
    </ClientOnly>
  </div>
</template>
