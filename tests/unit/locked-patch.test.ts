import { describe, it, expect } from 'vitest'
import { pickUnlockedFields } from '../../server/domain/provenance/locked-patch'

describe('pickUnlockedFields', () => {
  it('drops locked keys from the proposed patch', () => {
    const patch = pickUnlockedFields({ title: 'Milan', placeName: 'Milano', arrivalAt: 1 }, ['title'])
    expect(patch).toEqual({ placeName: 'Milano', arrivalAt: 1 })
  })

  it('returns everything when nothing is locked', () => {
    const patch = pickUnlockedFields({ a: 1, b: 2 }, [])
    expect(patch).toEqual({ a: 1, b: 2 })
  })

  it('returns an empty patch when everything is locked', () => {
    const patch = pickUnlockedFields({ a: 1, b: 2 }, ['a', 'b'])
    expect(patch).toEqual({})
  })
})
