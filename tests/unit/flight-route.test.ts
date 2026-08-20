import { describe, it, expect } from 'vitest'
import { findFlightRouteIn } from '../../server/geo/route-lookup/flight-route'
import type { Airport } from '../../server/geo/route-lookup/airports'

const AIRPORTS: Airport[] = [
  { iata: 'AMS', name: 'Amsterdam Schiphol', lat: 52.3105, lon: 4.7683, country: 'NL' },
  { iata: 'JFK', name: 'John F Kennedy Intl', lat: 40.6413, lon: -73.7781, country: 'US' },
  { iata: 'CDG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479, country: 'FR' }
]

describe('findFlightRouteIn', () => {
  it('matches the nearest airport to each endpoint and returns a great-circle route between them', () => {
    const result = findFlightRouteIn(AIRPORTS, { lat: 52.37, lon: 4.9 }, { lat: 40.7, lon: -74.0 })
    expect(result).not.toBeNull()
    expect(result!.reason).toContain('AMS')
    expect(result!.reason).toContain('JFK')
    expect(result!.geom[0]!.lat).toBeCloseTo(52.3105, 3)
    expect(result!.distanceM).toBeGreaterThan(5_000_000)
  })

  it('returns null when no airport is within range of an endpoint', () => {
    const farFromAnyAirport = { lat: -10, lon: -150 } // middle of the Pacific
    const result = findFlightRouteIn(AIRPORTS, { lat: 52.37, lon: 4.9 }, farFromAnyAirport)
    expect(result).toBeNull()
  })

  it('returns null when both endpoints resolve to the same airport', () => {
    const result = findFlightRouteIn(AIRPORTS, { lat: 52.3, lon: 4.7 }, { lat: 52.32, lon: 4.8 })
    expect(result).toBeNull()
  })
})
