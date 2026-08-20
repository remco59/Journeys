import type { ReverseGeocodeProvider, PlaceResult } from '../types'

type PhotonProperties = {
  name?: string
  street?: string
  city?: string
  town?: string
  village?: string
  district?: string
  state?: string
  country?: string
  osm_value?: string
  type?: string
}

export class PhotonProvider implements ReverseGeocodeProvider {
  readonly name = 'photon'

  constructor(private readonly baseUrl: string) {}

  async reverseGeocode(lat: number, lon: number): Promise<PlaceResult | null> {
    const url = `${this.baseUrl}/reverse?lat=${lat}&lon=${lon}&lang=en`
    const res = await fetch(url, {
      headers: { 'user-agent': 'journeys-self-hosted-app (reverse-geocoding)' },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) {
      throw new Error(`Photon reverse geocode failed: ${res.status}`)
    }
    const body = (await res.json()) as { features?: Array<{ properties: PhotonProperties }> }
    const props = body.features?.[0]?.properties
    if (!props) return null

    const locality = props.city ?? props.town ?? props.village ?? props.district ?? null
    // Only surface district as a distinct, finer-than-city qualifier when we
    // also have a city/town — otherwise it's already doing locality's job.
    const district = props.district && props.district !== locality ? props.district : null

    return {
      name: props.name ?? props.street ?? null,
      locality,
      district,
      adminArea: props.state ?? null,
      country: props.country ?? null,
      placeType: props.osm_value ?? props.type ?? null,
      raw: props as Record<string, unknown>
    }
  }
}
