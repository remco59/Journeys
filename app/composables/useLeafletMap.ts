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

  onMounted(() => {
    if (!container.value) return
    const config = useRuntimeConfig()

    map.value = L.map(container.value, { zoomControl: true, scrollWheelZoom: true, ...options }).setView([20, 0], 2)
    L.tileLayer(config.public.tileProviderUrl, {
      attribution: config.public.tileAttribution,
      maxZoom: 19
    }).addTo(map.value)
  })

  onUnmounted(() => {
    map.value?.remove()
    map.value = null
  })

  function fitToBounds(bounds: L.LatLngBoundsExpression, padding: L.PointExpression = [40, 40]) {
    if (!map.value) return
    map.value.fitBounds(bounds, { padding })
  }

  function focus(latlng: L.LatLngExpression, zoom = 15) {
    map.value?.flyTo(latlng, zoom)
  }

  return { map, fitToBounds, focus }
}
