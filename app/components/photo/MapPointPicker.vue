<script setup lang="ts">
import L from 'leaflet'

const props = withDefaults(defineProps<{ modelValue: { lat: number; lon: number } | null; clearable?: boolean }>(), { clearable: true })
const emit = defineEmits<{ 'update:modelValue': [point: { lat: number; lon: number } | null] }>()

const containerEl = ref<HTMLElement | null>(null)
const { map } = useLeafletMap(containerEl, { zoomControl: true })

let marker: L.Marker | undefined

function placeMarker(point: { lat: number; lon: number }) {
  if (!map.value) return
  if (marker) {
    marker.setLatLng([point.lat, point.lon])
  } else {
    marker = L.marker([point.lat, point.lon], { draggable: true }).addTo(map.value)
    marker.on('dragend', () => {
      const pos = marker!.getLatLng()
      emit('update:modelValue', { lat: pos.lat, lon: pos.lng })
    })
  }
}

watch(
  map,
  (m) => {
    if (!m) return
    const start = props.modelValue ?? { lat: 20, lon: 0 }
    m.setView([start.lat, start.lon], props.modelValue ? 13 : 2)
    if (props.modelValue) placeMarker(props.modelValue)

    m.on('click', (e: L.LeafletMouseEvent) => {
      const point = { lat: e.latlng.lat, lon: e.latlng.lng }
      placeMarker(point)
      emit('update:modelValue', point)
    })
  },
  { immediate: true }
)

function clear() {
  emit('update:modelValue', null)
  if (marker && map.value) {
    map.value.removeLayer(marker)
    marker = undefined
  }
}
</script>

<template>
  <div>
    <div ref="containerEl" class="h-52 w-full overflow-hidden rounded-xl" />
    <div class="mt-1.5 flex items-center justify-between font-mono text-xs text-(--color-ink-soft)">
      <span>{{ modelValue ? `${modelValue.lat.toFixed(5)}, ${modelValue.lon.toFixed(5)}` : 'Click the map to set a location' }}</span>
      <button v-if="modelValue && clearable" type="button" class="hover:text-(--color-ink)" @click="clear">Clear</button>
    </div>
  </div>
</template>
