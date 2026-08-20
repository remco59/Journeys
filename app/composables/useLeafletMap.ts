import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Thin imperative wrapper around a Leaflet map instance — not a component
 * wrapper library, per architecture plan §14. Leaflet touches window/
 * document directly, so every call here must happen client-side only
 * (guaranteed by onMounted, which never runs during SSR).
 */
export function useLeafletMap(container: Ref<HTMLElement | null>, options?: L.MapOptions) {
  const map = shallowRef<L.Map | null>(null)
  let resizeObserver: ResizeObserver | undefined

  onMounted(() => {
    if (!container.value) return
    const config = useRuntimeConfig()

    map.value = L.map(container.value, { zoomControl: true, scrollWheelZoom: true, ...options }).setView([20, 0], 2)
    L.tileLayer(config.public.tileProviderUrl, {
      attribution: config.public.tileAttribution,
      maxZoom: 19
    }).addTo(map.value)

    // The container can still be mid page/tab transition (transform-driven,
    // so briefly its own containing block) when Leaflet measures it here,
    // which bakes in a stale size Leaflet never revisits on its own — watch
    // the real box and keep the map in sync with it.
    resizeObserver = new ResizeObserver(() => map.value?.invalidateSize())
    resizeObserver.observe(container.value)
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    map.value?.remove()
    map.value = null
  })

  function fitToBounds(bounds: L.LatLngBoundsExpression, padding: L.PointExpression = [40, 40], attempt = 0) {
    if (!map.value) return
    // Right after the panel's own tab-switch transition inserts this
    // container, its box can still measure zero-height for a few frames
    // (mid-transition layout) — fitBounds against that collapses to
    // maxZoom instead of framing the route. Wait for a real size.
    const { width, height } = map.value.getContainer().getBoundingClientRect()
    if ((width === 0 || height === 0) && attempt < 60) {
      requestAnimationFrame(() => fitToBounds(bounds, padding, attempt + 1))
      return
    }
    map.value.invalidateSize()
    map.value.fitBounds(bounds, { padding })
  }

  function focus(latlng: L.LatLngExpression, zoom = 15) {
    map.value?.flyTo(latlng, zoom)
  }

  return { map, fitToBounds, focus }
}
