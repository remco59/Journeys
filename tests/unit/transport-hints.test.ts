import { describe, it, expect } from 'vitest'
import { mapTransportHint } from '../../server/domain/traces/transport-hints'

describe('mapTransportHint', () => {
  it('maps legacy SCREAMING_SNAKE_CASE Timeline hints', () => {
    expect(mapTransportHint('IN_TRAIN')).toBe('train')
    expect(mapTransportHint('IN_PASSENGER_VEHICLE')).toBe('car')
    expect(mapTransportHint('WALKING')).toBe('walking')
    expect(mapTransportHint('FLYING')).toBe('flight')
  })
  it('maps the current lowercase/spaced hints', () => {
    expect(mapTransportHint('in passenger vehicle')).toBe('car')
    expect(mapTransportHint('cycling')).toBe('cycling')
  })
  it('falls back to unknown for unrecognized or missing hints', () => {
    expect(mapTransportHint('teleporting')).toBe('unknown')
    expect(mapTransportHint(null)).toBe('unknown')
    expect(mapTransportHint(undefined)).toBe('unknown')
  })
})
