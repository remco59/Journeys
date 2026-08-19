import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '../../server/utils/rate-limit'

describe('checkRateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000)).toBe(true)
    }
    expect(checkRateLimit(key, 3, 60_000)).toBe(false)
  })

  it('tracks separate keys independently', () => {
    const keyA = `a-${Math.random()}`
    const keyB = `b-${Math.random()}`
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(true)
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(false)
    expect(checkRateLimit(keyB, 1, 60_000)).toBe(true)
  })
})
