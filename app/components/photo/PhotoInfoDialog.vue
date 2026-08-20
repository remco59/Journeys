<script setup lang="ts">
import L from 'leaflet'

type Photo = {
  id: string
  caption: string | null
  capturedAt: string | null
  cameraMake?: string | null
  cameraModel?: string | null
  altitudeM?: number | null
  locationSource: string
  lat?: number | null
  lon?: number | null
}

const dialog = ref<HTMLDialogElement | null>(null)
const photo = ref<Photo | null>(null)
const sectionTitle = ref<string | null>(null)

function open(p: Photo, section: string | null) {
  photo.value = p
  sectionTitle.value = section
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

const point = computed(() => (photo.value?.lat != null && photo.value?.lon != null ? { lat: photo.value.lat, lon: photo.value.lon } : null))

const mapEl = ref<HTMLElement | null>(null)
const { map } = useLeafletMap(mapEl, { zoomControl: false, dragging: true, scrollWheelZoom: false })
let marker: L.Marker | undefined

watch(
  [map, point],
  ([m, p]) => {
    if (!m) return
    if (marker) {
      m.removeLayer(marker)
      marker = undefined
    }
    if (p) {
      m.setView([p.lat, p.lon], 13)
      const html = `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#d89b4a;border:2.5px solid #141a20;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`
      marker = L.marker([p.lat, p.lon], { icon: L.divIcon({ html, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(m)
    }
  },
  { immediate: true }
)

const dateLabel = computed(() => {
  if (!photo.value?.capturedAt) return null
  return new Date(photo.value.capturedAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})
const cameraLabel = computed(() => {
  const p = photo.value
  if (!p) return null
  return [p.cameraMake, p.cameraModel].filter(Boolean).join(' ') || null
})
const coordsLabel = computed(() => (point.value ? `${point.value.lat.toFixed(5)}, ${point.value.lon.toFixed(5)}` : null))
const altitudeLabel = computed(() => (photo.value?.altitudeM != null ? `${Math.round(photo.value.altitudeM).toLocaleString()} m` : null))
const LOCATION_SOURCE_LABEL: Record<string, string> = {
  exif: 'From photo metadata',
  inferred: 'Inferred from nearby photos',
  manual: 'Set manually',
  unresolved: 'Not detected'
}
const locationSourceLabel = computed(() => (photo.value ? (LOCATION_SOURCE_LABEL[photo.value.locationSource] ?? photo.value.locationSource) : null))
</script>

<template>
  <dialog ref="dialog" class="sheet">
    <div class="sheet-handle" />
    <div class="flex flex-col gap-4 p-6 pt-2">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Photo details</h2>
        <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="close">✕</button>
      </div>

      <p v-if="photo?.caption" class="text-sm text-(--color-ink)">{{ photo.caption }}</p>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div v-if="dateLabel" class="col-span-2">
          <dt class="eyebrow text-(--color-ink-soft)">Date &amp; time</dt>
          <dd class="mt-0.5">{{ dateLabel }}</dd>
        </div>
        <div v-if="sectionTitle">
          <dt class="eyebrow text-(--color-ink-soft)">Section</dt>
          <dd class="mt-0.5">{{ sectionTitle }}</dd>
        </div>
        <div v-if="cameraLabel">
          <dt class="eyebrow text-(--color-ink-soft)">Camera</dt>
          <dd class="mt-0.5">{{ cameraLabel }}</dd>
        </div>
        <div v-if="coordsLabel">
          <dt class="eyebrow text-(--color-ink-soft)">Coordinates</dt>
          <dd class="mt-0.5 font-mono text-xs">{{ coordsLabel }}</dd>
        </div>
        <div v-if="altitudeLabel">
          <dt class="eyebrow text-(--color-ink-soft)">Altitude</dt>
          <dd class="mt-0.5">{{ altitudeLabel }}</dd>
        </div>
        <div v-if="locationSourceLabel">
          <dt class="eyebrow text-(--color-ink-soft)">Location source</dt>
          <dd class="mt-0.5">{{ locationSourceLabel }}</dd>
        </div>
      </dl>

      <div v-show="point" ref="mapEl" class="h-40 w-full overflow-hidden rounded-xl" />
      <p v-if="!point" class="rounded-xl bg-(--color-paper-raised) p-3 text-center text-xs text-(--color-ink-soft)">No location data for this photo.</p>
    </div>
  </dialog>
</template>
