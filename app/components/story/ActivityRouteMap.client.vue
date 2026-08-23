<script setup lang="ts">
import L from 'leaflet'

const props = defineProps<{ geom: { type: 'LineString'; coordinates: [number, number][] } | null }>()

const containerEl = ref<HTMLElement | null>(null)
const { map, fitToBounds } = useLeafletMap(containerEl, {
  zoomControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  touchZoom: false
})

watch(
  map,
  (m) => {
    if (!m || !props.geom) return
    const latlngs = props.geom.coordinates.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)
    const line = L.polyline(latlngs, { color: 'var(--color-activity)', weight: 3 }).addTo(m)
    fitToBounds(line.getBounds(), [16, 16])
  },
  { immediate: true }
)
</script>

<template>
  <div ref="containerEl" class="h-40 w-full overflow-hidden rounded-xl" />
</template>
