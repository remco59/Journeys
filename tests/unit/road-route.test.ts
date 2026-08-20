import { describe, it, expect } from 'vitest'
import { parseOsrmResponse } from '../../server/geo/route-lookup/road-route'

describe('parseOsrmResponse', () => {
  it('extracts geometry and distance from a successful OSRM route', () => {
    const body = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [4.9041, 52.3676],
              [5.0, 52.3],
              [5.1101, 52.0894]
            ] as [number, number][]
          },
          distance: 42000.5
        }
      ]
    }
    const result = parseOsrmResponse(body, 'Routed by car along OpenStreetMap roads (OSRM)')
    expect(result).not.toBeNull()
    expect(result!.distanceM).toBe(42000.5)
    expect(result!.geom[0]).toEqual({ lat: 52.3676, lon: 4.9041 })
    expect(result!.geom[2]).toEqual({ lat: 52.0894, lon: 5.1101 })
    expect(result!.reason).toBe('Routed by car along OpenStreetMap roads (OSRM)')
  })

  it('returns null when OSRM reports no route', () => {
    expect(parseOsrmResponse({ code: 'NoRoute' }, 'reason')).toBeNull()
  })

  it('returns null when the response has no routes', () => {
    expect(parseOsrmResponse({ code: 'Ok', routes: [] }, 'reason')).toBeNull()
  })

  it('returns null when the route geometry is empty', () => {
    const body = { code: 'Ok', routes: [{ geometry: { coordinates: [] as [number, number][] }, distance: 0 }] }
    expect(parseOsrmResponse(body, 'reason')).toBeNull()
  })
})
