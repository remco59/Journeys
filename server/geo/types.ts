export type PlaceResult = {
  /** Most specific name available — a POI or street name, when the provider has one. */
  name: string | null
  locality: string | null
  /** Neighborhood/suburb/district — finer than locality (city), when the provider has one. */
  district: string | null
  adminArea: string | null
  country: string | null
  /** Provider's own place-type hint (e.g. "city", "village", "attraction"). */
  placeType: string | null
  raw: Record<string, unknown>
}

export interface ReverseGeocodeProvider {
  readonly name: string
  reverseGeocode(lat: number, lon: number): Promise<PlaceResult | null>
}
