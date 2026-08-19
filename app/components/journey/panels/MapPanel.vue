<script setup lang="ts">
import L from 'leaflet'
import { useMapSyncStore } from '../../../stores/mapSync'

type Section = { id: string; title: string; placeName: string | null; lat: number | null; lon: number | null }
type TraceGeom = { type: 'LineString'; coordinates: [number, number][] } | null
type TransportMode = 'walking' | 'cycling' | 'car' | 'train' | 'bus' | 'ferry' | 'flight' | 'unknown'
type Trace = {
  id: string
  type: 'travel' | 'activity' | 'unknown'
  confidence: 'high' | 'medium' | 'low' | 'inferred'
  transportMode: TransportMode
  transportModeReason: string | null
  geom: TraceGeom
}
type Photo = { id: string; sectionId: string | null; storageKeyThumb: string | null; capturedAt: string | null }

const props = defineProps<{ sections: Section[]; traces: Trace[]; photos: Photo[] }>()
const emit = defineEmits<{ editTrace: [traceId: string, transportMode: TransportMode] }>()

const GOLD = '#b8862f'
const PINE = '#2f6b52'
const TRANSPORT_MODES: TransportMode[] = ['walking', 'cycling', 'car', 'train', 'bus', 'ferry', 'flight', 'unknown']

const mapSync = useMapSyncStore()
const filesBase = useFilesBase()
const readonly = useReadonly()
const containerEl = ref<HTMLElement | null>(null)
const { map, fitToBounds, focus } = useLeafletMap(containerEl)

const firstPhotoBySection = computed(() => {
  const found = new Map<string, Photo>()
  for (const photo of props.photos) {
    if (photo.sectionId && !found.has(photo.sectionId)) found.set(photo.sectionId, photo)
  }
  return found
})

let markerLayer: L.LayerGroup | undefined
let traceLayer: L.LayerGroup | undefined
const markersById = new Map<string, L.Marker>()

function traceStyle(trace: Trace): L.PolylineOptions {
  if (trace.type === 'activity') return { color: PINE, weight: 4, opacity: 0.9 }
  if (trace.confidence === 'inferred' || trace.confidence === 'low') {
    return { color: GOLD, weight: 3, opacity: 0.75, dashArray: '2 8' }
  }
  return { color: GOLD, weight: 3, opacity: 0.85 }
}

function buildTracePopup(trace: Trace): HTMLElement {
  const container = document.createElement('div')
  container.style.cssText = 'font-family:system-ui,sans-serif;font-size:13px;min-width:170px'

  const reason = document.createElement('div')
  reason.style.cssText = 'margin-bottom:6px;color:#666;font-size:12px'
  reason.textContent = trace.transportModeReason ?? 'No inference reason recorded'
  container.appendChild(reason)

  if (readonly) {
    const label = document.createElement('div')
    label.style.cssText = 'font-weight:600'
    label.textContent = trace.transportMode
    container.appendChild(label)
    return container
  }

  const select = document.createElement('select')
  select.style.cssText = 'width:100%;padding:2px 4px'
  for (const mode of TRANSPORT_MODES) {
    const option = document.createElement('option')
    option.value = mode
    option.textContent = mode
    if (mode === trace.transportMode) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => emit('editTrace', trace.id, select.value as TransportMode))
  container.appendChild(select)

  return container
}

function render() {
  if (!map.value) return

  markerLayer?.clearLayers()
  traceLayer?.clearLayers()
  markerLayer ??= L.layerGroup().addTo(map.value)
  traceLayer ??= L.layerGroup().addTo(map.value)
  markersById.clear()

  const boundsPoints: L.LatLngExpression[] = []

  for (const trace of props.traces) {
    if (!trace.geom) continue
    const latlngs = trace.geom.coordinates.map(([lon, lat]) => [lat, lon] as L.LatLngExpression)
    const line = L.polyline(latlngs, traceStyle(trace)).addTo(traceLayer)
    line.bindPopup(buildTracePopup(trace))
    boundsPoints.push(...latlngs)
  }

  for (const section of props.sections) {
    if (section.lat == null || section.lon == null) continue
    const photo = firstPhotoBySection.value.get(section.id)
    const iconHtml = photo?.storageKeyThumb
      ? `<img src="${filesBase}/${encodeURIComponent(photo.storageKeyThumb)}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)" />`
      : `<div style="width:100%;height:100%;border-radius:9999px;background:${GOLD};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`

    const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [36, 36] })
    const marker = L.marker([section.lat, section.lon], { icon }).addTo(markerLayer)
    marker.bindTooltip(section.title)
    marker.on('click', () => mapSync.select(section.id))
    markersById.set(section.id, marker)
    boundsPoints.push([section.lat, section.lon])
  }

  if (boundsPoints.length > 0) fitToBounds(L.latLngBounds(boundsPoints))
}

watch(() => [props.sections, props.traces, map.value] as const, render, { deep: true })

watch(
  () => mapSync.selectedSectionId,
  (id) => {
    if (!id) return
    const marker = markersById.get(id)
    if (marker) focus(marker.getLatLng())
  }
)
</script>

<template>
  <div ref="containerEl" class="h-[calc(100vh-6rem)] w-full" />
</template>
