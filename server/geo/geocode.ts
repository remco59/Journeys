import { and, eq } from 'drizzle-orm'
import { serverConfig } from '../config'
import { useDb } from '../db/client'
import { placeCache } from '../db/schema'
import { PhotonProvider } from './providers/photon'
import type { ReverseGeocodeProvider, PlaceResult } from './types'

const CACHE_TTL_DAYS = 90
const CACHE_PRECISION = 3 // ~111m grid cells at the equator — plenty for a reverse-geocode cache

function cacheKeyFor(lat: number, lon: number): string {
  return `${lat.toFixed(CACHE_PRECISION)},${lon.toFixed(CACHE_PRECISION)}`
}

let provider: ReverseGeocodeProvider | undefined

function getProvider(): ReverseGeocodeProvider {
  if (!provider) {
    if (serverConfig.geocodeProvider === 'photon') {
      provider = new PhotonProvider(serverConfig.geocodeBaseUrl)
    } else {
      throw new Error(`Unknown geocode provider: ${serverConfig.geocodeProvider}`)
    }
  }
  return provider
}

/** Reverse geocode, cache-first. See architecture plan §07 — providers are swappable, results are cached. */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceResult | null> {
  const db = useDb()
  const p = getProvider()
  const key = cacheKeyFor(lat, lon)

  const cached = await db
    .select()
    .from(placeCache)
    .where(and(eq(placeCache.provider, p.name), eq(placeCache.cacheKey, key)))
    .limit(1)

  const hit = cached[0]
  if (hit && hit.expiresAt.getTime() > Date.now()) {
    return {
      name: hit.placeName,
      locality: hit.locality,
      district: hit.district,
      adminArea: hit.adminArea,
      country: hit.country,
      placeType: hit.placeType,
      raw: (hit.raw as Record<string, unknown>) ?? {}
    }
  }

  const result = await p.reverseGeocode(lat, lon)
  if (!result) return null

  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db
    .insert(placeCache)
    .values({
      provider: p.name,
      cacheKey: key,
      lat,
      lon,
      placeName: result.name,
      locality: result.locality,
      district: result.district,
      adminArea: result.adminArea,
      country: result.country,
      placeType: result.placeType,
      raw: result.raw,
      expiresAt
    })
    .onConflictDoUpdate({
      target: [placeCache.provider, placeCache.cacheKey],
      set: {
        placeName: result.name,
        locality: result.locality,
        district: result.district,
        adminArea: result.adminArea,
        country: result.country,
        placeType: result.placeType,
        raw: result.raw,
        expiresAt,
        createdAt: new Date()
      }
    })

  return result
}
