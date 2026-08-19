import { describe, it, expect } from 'vitest'
import { simplifyPath, simplifyToApproxCount } from '../../server/domain/geo/simplify'

describe('simplifyPath', () => {
  it('collapses a perfectly straight line down to its two endpoints', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ lat: 45 + i * 0.0001, lon: 9 }))
    const simplified = simplifyPath(points, 1)
    expect(simplified).toHaveLength(2)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1])
  })

  it('preserves a sharp corner that exceeds the tolerance', () => {
    const points = [
      { lat: 45, lon: 9 },
      { lat: 45.01, lon: 9 }, // corner sticks out ~1.1km
      { lat: 45.02, lon: 9.02 }
    ]
    const simplified = simplifyPath(points, 50)
    expect(simplified).toHaveLength(3)
  })

  it('leaves paths of 2 or fewer points untouched', () => {
    const points = [{ lat: 45, lon: 9 }]
    expect(simplifyPath(points, 1)).toEqual(points)
  })
})

describe('simplifyToApproxCount', () => {
  it('reduces a dense straight-line track close to the target count', () => {
    const points = Array.from({ length: 2000 }, (_, i) => ({ lat: 45 + i * 0.00001, lon: 9 }))
    const result = simplifyToApproxCount(points, 50)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('leaves an already-small path alone', () => {
    const points = [{ lat: 45, lon: 9 }, { lat: 45.01, lon: 9.01 }]
    expect(simplifyToApproxCount(points, 500)).toEqual(points)
  })
})
