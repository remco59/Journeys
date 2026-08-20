import { describe, it, expect } from 'vitest'
import { findRailPathInWays } from '../../server/geo/route-lookup/rail-route'

type Way = { type: 'way'; id: number; nodes: number[]; geometry: { lat: number; lon: number }[] }

describe('findRailPathInWays', () => {
  const from = { lat: 52.0, lon: 5.0 }
  const to = { lat: 52.0, lon: 5.1 }

  // Two ways sharing node 3, forming one connected track from near `from` to near `to`.
  const connectedWays: Way[] = [
    {
      type: 'way',
      id: 100,
      nodes: [1, 2, 3],
      geometry: [
        { lat: 52.0, lon: 5.001 },
        { lat: 52.0, lon: 5.03 },
        { lat: 52.0, lon: 5.05 }
      ]
    },
    {
      type: 'way',
      id: 101,
      nodes: [3, 4, 5],
      geometry: [
        { lat: 52.0, lon: 5.05 },
        { lat: 52.0, lon: 5.07 },
        { lat: 52.0, lon: 5.099 }
      ]
    }
  ]

  it('finds a path across two ways joined by a shared node', () => {
    const result = findRailPathInWays(connectedWays, from, to)
    expect(result).not.toBeNull()
    expect(result!.geom[0]).toEqual(from)
    expect(result!.geom[result!.geom.length - 1]).toEqual(to)
    expect(result!.distanceM).toBeGreaterThan(0)
  })

  it('rejects when the nearest track is too far from an endpoint', () => {
    const farTo = { lat: 53.0, lon: 6.0 }
    expect(findRailPathInWays(connectedWays, from, farTo)).toBeNull()
  })

  it('rejects when there is no track at all', () => {
    expect(findRailPathInWays([], from, to)).toBeNull()
  })

  it('rejects a path that detours implausibly far past the straight-line distance', () => {
    // Both endpoints have a nearby node, but the only connecting track loops
    // out to the other side of the world first.
    const detourWays: Way[] = [
      {
        type: 'way',
        id: 200,
        nodes: [1, 2],
        geometry: [
          { lat: 52.0, lon: 5.001 },
          { lat: 10, lon: 100 }
        ]
      },
      {
        type: 'way',
        id: 201,
        nodes: [2, 3],
        geometry: [
          { lat: 10, lon: 100 },
          { lat: 52.0, lon: 5.099 }
        ]
      }
    ]
    expect(findRailPathInWays(detourWays, from, to)).toBeNull()
  })
})
