<script setup lang="ts">
import L from 'leaflet'
import { useMapSyncStore } from '../../../stores/mapSync'

type Section = { id: string; title: string; placeName: string | null; lat: number | null; lon: number | null }
type TraceGeom = { type: 'LineString'; coordinates: [number, number][] } | null
// 'unknown' isn't offered in the UI (see TRANSPORT_MODES below) but stays in
// the type since the DB enum still permits it on old/unmigrated rows.
type TransportMode = 'walking' | 'cycling' | 'car' | 'train' | 'bus' | 'ferry' | 'flight' | 'unsure' | 'unknown'
type Trace = {
  id: string
  fromSectionId: string | null
  toSectionId: string | null
  type: 'travel' | 'activity' | 'unknown'
  confidence: 'high' | 'medium' | 'low' | 'inferred'
  transportMode: TransportMode
  transportModeReason: string | null
  startedAt: string | null
  endedAt: string | null
  geom: TraceGeom
}
type Photo = { id: string; sectionId: string | null; storageKeyThumb: string | null; capturedAt: string | null; lat?: number | null; lon?: number | null }

const props = defineProps<{ sections: Section[]; traces: Trace[]; photos: Photo[] }>()
const emit = defineEmits<{ editTrace: [traceId: string, transportMode: TransportMode] }>()

const TEAL = '#2e5c58'
const GOLD = '#d89b4a'
const STONE = '#8c8172'
const INK = '#141a20'
// Sections are shown as an approximate "fuzz" circle rather than a precise
// point — sized from the real spread of a section's geotagged photos where
// we have it, otherwise a generic default (e.g. on the shared view, where
// per-photo coordinates aren't sent to the client at all).
const FUZZ_MIN_RADIUS_M = 60
const FUZZ_DEFAULT_RADIUS_M = 140
const FUZZ_PADDING = 1.35
const TRANSPORT_MODES: TransportMode[] = ['walking', 'cycling', 'car', 'train', 'bus', 'ferry', 'flight', 'unsure']
const TRANSPORT_MODE_GLYPHS: Record<TransportMode, string> = {
  flight: '✈️',
  train: '🚆',
  car: '🚗',
  cycling: '🚴',
  walking: '🚶',
  bus: '🚌',
  ferry: '⛴️',
  unsure: '❓',
  unknown: '❓'
}

const mapSync = useMapSyncStore()
const readonly = useReadonly()
const actions = useJourneyActions()
const filesBase = useFilesBase()
const linkBase = useLinkBase()
const route = useRoute()
const containerEl = ref<HTMLElement | null>(null)
const { map, fitToBounds, focus } = useLeafletMap(containerEl, { zoomControl: false })
// A location tag on the story page sends the user here with a section to
// zoom in on (handled by the mapSync watcher below) — the initial overview
// fit would just fight that flyTo, so skip it in this case.
const initialFocusSectionId = typeof route.query.section === 'string' ? route.query.section : null

let markerLayer: L.LayerGroup | undefined
let traceLayer: L.LayerGroup | undefined
let circleLayer: L.LayerGroup | undefined
const markersById = new Map<string, L.Marker>()
// Only auto-fit the very first time there's something to show — a later
// re-render (e.g. after saving a trace's transport mode) refreshes the
// data and rebuilds the layers, but shouldn't yank the user's pan/zoom
// back out to fit everything again.
let hasFitBounds = false

// Line style encodes meaning, not just color: solid teal = confirmed, orange
// dashes = likely, fine stone dots = inferred. Recorded activity/travel GPS
// (real data, not a guess) counts as confirmed regardless of nominal confidence.
function traceStyle(trace: Trace): L.PolylineOptions {
  if (trace.type === 'activity' || trace.confidence === 'high') return { color: TEAL, weight: 4, opacity: 0.9 }
  if (trace.confidence === 'medium') return { color: GOLD, weight: 3, opacity: 0.85, dashArray: '2 10' }
  return { color: STONE, weight: 3, opacity: 0.7, dashArray: '1 9' }
}

function sectionName(sectionId: string | null): string {
  const section = props.sections.find((s) => s.id === sectionId)
  return section?.title || section?.placeName || 'Unknown place'
}

/** "Aug 19, 09:00 – 09:55", or spanning dates if the gap crosses midnight. */
function formatTraceTimeRange(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return startedAt ? `${formatDayMonth(startedAt)}, ${formatTime(startedAt)}` : ''
  const sameDay = new Date(startedAt).toDateString() === new Date(endedAt).toDateString()
  const end = sameDay ? formatTime(endedAt) : `${formatDayMonth(endedAt)}, ${formatTime(endedAt)}`
  return `${formatDayMonth(startedAt)}, ${formatTime(startedAt)} – ${end}`
}

function buildTracePopup(trace: Trace): HTMLElement {
  const container = document.createElement('div')
  container.style.cssText = "font-family:'Inter',system-ui,sans-serif;font-size:13px;min-width:170px"

  const header = document.createElement('div')
  header.style.cssText = 'font-weight:700;color:#141a20;margin-bottom:2px'
  header.textContent = `${sectionName(trace.fromSectionId)} → ${sectionName(trace.toSectionId)}`
  container.appendChild(header)

  const timeRange = formatTraceTimeRange(trace.startedAt, trace.endedAt)
  if (timeRange) {
    const timeEl = document.createElement('div')
    timeEl.style.cssText = 'color:#8c8172;font-size:12px;margin-bottom:6px'
    timeEl.textContent = timeRange
    container.appendChild(timeEl)
  }

  const reason = document.createElement('div')
  reason.style.cssText = "margin-bottom:6px;color:#8c8172;font-size:12px;font-family:'IBM Plex Mono',monospace"
  reason.textContent = trace.transportModeReason ?? 'No inference reason recorded'
  container.appendChild(reason)

  if (readonly) {
    const label = document.createElement('div')
    label.style.cssText = 'font-weight:600;color:#141a20'
    label.textContent = trace.transportMode
    container.appendChild(label)
    return container
  }

  const select = document.createElement('select')
  select.style.cssText = 'width:100%;padding:4px 6px;border-radius:8px;border:1px solid rgba(20,26,32,0.15)'
  for (const mode of TRANSPORT_MODES) {
    const option = document.createElement('option')
    option.value = mode
    option.textContent = mode
    if (mode === trace.transportMode) option.selected = true
    select.appendChild(option)
  }
  container.appendChild(select)

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.textContent = 'Save & recalculate route'
  saveBtn.style.cssText =
    'margin-top:8px;width:100%;padding:6px 8px;border-radius:8px;border:none;background:#2e5c58;color:#fbf7ee;font-weight:600;font-size:12px;cursor:pointer'
  // Changing the mode can trigger a real route lookup (Overpass/OSRM), which
  // takes a moment — saving on an explicit click (not on every dropdown
  // change) makes that latency expected rather than surprising. The button
  // stays disabled until the parent's data refresh replaces this whole
  // popup with a freshly rendered one (see render()'s traceLayer rebuild).
  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'
    emit('editTrace', trace.id, select.value as TransportMode)
  })
  container.appendChild(saveBtn)

  return container
}

function firstThumbUrlBySection(): Map<string, string> {
  const map = new Map<string, string>()
  for (const photo of props.photos) {
    if (!photo.sectionId || map.has(photo.sectionId) || !photo.storageKeyThumb) continue
    map.set(photo.sectionId, `${filesBase}/${encodeURIComponent(photo.storageKeyThumb)}`)
  }
  return map
}

function transportModeIcon(mode: TransportMode): L.DivIcon {
  const html = `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:rgba(20,26,32,0.78);font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.35)">${TRANSPORT_MODE_GLYPHS[mode]}</span>`
  return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
}

function markerIcon(thumbUrl: string | undefined): L.DivIcon {
  const html = thumbUrl
    ? `<span style="display:block;width:48px;height:48px;border-radius:9999px;background:${INK} url('${thumbUrl}') center/cover;border:3px solid ${GOLD};box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`
    : `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:${GOLD};border:3px solid ${INK};box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`
  const size = thumbUrl ? 48 : 22
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

type FuzzCircle = { center: L.LatLng; radius: number }

/** One approximate coverage circle per section, keyed by section id. */
function sectionFuzzCircles(): Map<string, FuzzCircle> {
  const circles = new Map<string, FuzzCircle>()
  for (const section of props.sections) {
    if (section.lat == null || section.lon == null) continue
    const center = L.latLng(section.lat, section.lon)
    const memberDistances = props.photos
      .filter((p) => p.sectionId === section.id && p.lat != null && p.lon != null)
      .map((p) => center.distanceTo(L.latLng(p.lat!, p.lon!)))
    const radius = memberDistances.length > 0 ? Math.max(...memberDistances) * FUZZ_PADDING : FUZZ_DEFAULT_RADIUS_M
    circles.set(section.id, { center, radius: Math.max(radius, FUZZ_MIN_RADIUS_M) })
  }
  return circles
}

function isInsideCircle(point: L.LatLng, circle: FuzzCircle): boolean {
  return circle.center.distanceTo(point) < circle.radius
}

/** Binary search along the inside→outside segment for where it crosses the circle's edge. */
function circleBoundaryPoint(inside: L.LatLng, outside: L.LatLng, circle: FuzzCircle): L.LatLng {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const candidate = L.latLng(inside.lat + (outside.lat - inside.lat) * mid, inside.lng + (outside.lng - inside.lng) * mid)
    if (isInsideCircle(candidate, circle)) lo = mid
    else hi = mid
  }
  return L.latLng(inside.lat + (outside.lat - inside.lat) * hi, inside.lng + (outside.lng - inside.lng) * hi)
}

/**
 * Drops the leading run of points that fall inside `circle` and replaces
 * them with the single point where the line first crosses its edge — so a
 * trace visually stops at the fuzz circle instead of revealing the precise
 * point it actually starts from.
 */
function trimToCircleStart(points: L.LatLng[], circle: FuzzCircle | undefined): L.LatLng[] {
  if (!circle) return points
  let i = 0
  while (i < points.length && isInsideCircle(points[i]!, circle)) i++
  if (i === 0) return points
  if (i >= points.length) return []
  return [circleBoundaryPoint(points[i - 1]!, points[i]!, circle), ...points.slice(i)]
}

function trimToCircleEnd(points: L.LatLng[], circle: FuzzCircle | undefined): L.LatLng[] {
  return trimToCircleStart([...points].reverse(), circle).reverse()
}

function render() {
  if (!map.value) return

  circleLayer?.clearLayers()
  markerLayer?.clearLayers()
  traceLayer?.clearLayers()
  circleLayer ??= L.layerGroup().addTo(map.value)
  markerLayer ??= L.layerGroup().addTo(map.value)
  traceLayer ??= L.layerGroup().addTo(map.value)
  markersById.clear()

  const boundsPoints: L.LatLngExpression[] = []
  const thumbBySection = firstThumbUrlBySection()
  const fuzzCircles = sectionFuzzCircles()

  // Drawn first so their paths land beneath trace lines in the shared
  // overlay pane (Leaflet stacks same-pane vector layers in paint order).
  for (const circle of fuzzCircles.values()) {
    L.circle(circle.center, {
      radius: circle.radius,
      color: GOLD,
      weight: 0,
      fillColor: GOLD,
      fillOpacity: 0.22,
      className: 'section-fuzz-circle',
      interactive: false
    }).addTo(circleLayer)
  }

  for (const trace of props.traces) {
    if (!trace.geom) continue
    const fullLatlngs = trace.geom.coordinates.map(([lon, lat]) => L.latLng(lat, lon))
    boundsPoints.push(...fullLatlngs)

    let latlngs = trimToCircleStart(fullLatlngs, trace.fromSectionId ? fuzzCircles.get(trace.fromSectionId) : undefined)
    latlngs = trimToCircleEnd(latlngs, trace.toSectionId ? fuzzCircles.get(trace.toSectionId) : undefined)
    if (latlngs.length < 2) continue

    const line = L.polyline(latlngs, traceStyle(trace)).addTo(traceLayer)
    line.bindPopup(buildTracePopup(trace))

    const midpoint = latlngs[Math.floor(latlngs.length / 2)]
    if (midpoint) {
      // Sits in the marker pane, above the line — without its own popup it
      // would just swallow clicks aimed at the line underneath instead of
      // opening the editor, right where a user would naturally click.
      const icon = L.marker(midpoint, { icon: transportModeIcon(trace.transportMode) }).addTo(traceLayer)
      icon.bindPopup(buildTracePopup(trace))
      icon.bindTooltip(trace.transportMode, { direction: 'top', offset: [0, -10] })
    }
  }

  for (let i = 0; i < props.sections.length; i++) {
    const section = props.sections[i]!
    if (section.lat == null || section.lon == null) continue
    const thumbUrl = thumbBySection.get(section.id)
    const marker = L.marker([section.lat, section.lon], { icon: markerIcon(thumbUrl) }).addTo(markerLayer)
    const clearance = (thumbUrl ? 24 : 11) + 6
    marker.bindTooltip(section.title, {
      permanent: true,
      direction: i % 2 === 0 ? 'top' : 'bottom',
      offset: i % 2 === 0 ? [0, -clearance] : [0, clearance],
      className: 'journey-map-label'
    })
    marker.on('click', () => navigateTo(`${linkBase}/story?section=${section.id}`))
    markersById.set(section.id, marker)
    boundsPoints.push([section.lat, section.lon])
  }

  if (boundsPoints.length > 0 && !hasFitBounds) {
    if (!initialFocusSectionId) fitToBounds(L.latLngBounds(boundsPoints), [56, 56])
    hasFitBounds = true
  }
}

watch(() => [props.sections, props.traces, props.photos, map.value] as const, render, { deep: true })

watch(
  () => mapSync.selectedSectionId,
  (id) => {
    if (!id) return
    const marker = markersById.get(id)
    if (marker) focus(marker.getLatLng())
  }
)

onMounted(() => {
  const sectionId = route.query.section
  if (typeof sectionId === 'string') mapSync.select(sectionId)
})
</script>

<template>
  <div class="fixed inset-0 bg-(--color-canvas)">
    <div ref="containerEl" class="relative z-0 h-full w-full" />

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/85 to-transparent" />

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div class="flex items-start gap-3">
        <JourneyBackButton v-if="!readonly" class="pointer-events-auto shrink-0" />
        <div class="pointer-events-none">
          <p class="eyebrow text-(--color-gold) drop-shadow">Route map</p>
          <h1 class="font-(family-name:--font-display) text-3xl font-medium text-(--color-cream) drop-shadow-sm">Your journey</h1>
        </div>
      </div>
      <button v-if="!readonly" class="dark-pill pointer-events-auto shrink-0 !px-4 !py-2.5" @click="actions.openAddSheet('activity')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add track
      </button>
    </div>

    <div
      class="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4"
      style="bottom: calc(6rem + env(safe-area-inset-bottom, 0px))"
    >
      <div class="pointer-events-auto">
        <JourneyMapLegend />
      </div>
    </div>
  </div>
</template>

<style>
.section-fuzz-circle {
  filter: blur(6px);
  pointer-events: none;
}

.journey-map-label {
  background: rgba(20, 26, 32, 0.78) !important;
  border: none !important;
  border-radius: 9999px !important;
  color: #fbf7ee !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 11px !important;
  padding: 4px 10px !important;
  box-shadow: none !important;
}
.journey-map-label::before {
  display: none !important;
}

/* Raster tiles are server-rendered imagery with no theme of their own — invert
   + rotate hue back roughly into place so the basemap goes dark along with
   the rest of the app instead of staying a bright rectangle in the middle
   of a dark screen. Popups are left alone; a native-looking white popover
   over a dark map is fine and matches how Leaflet's own chrome behaves. */
html.dark .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.9) saturate(0.7);
}

html.dark .leaflet-control-attribution {
  background: rgba(23, 27, 31, 0.75) !important;
  color: var(--color-ink-soft) !important;
}
html.dark .leaflet-control-attribution a {
  color: var(--color-ink-soft) !important;
}
</style>
