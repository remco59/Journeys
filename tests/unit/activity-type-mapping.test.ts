import { describe, it, expect } from 'vitest'
import { mapGpxActivityType } from '../../server/import/gpx/type-mapping'
import { mapTcxSport } from '../../server/import/tcx/type-mapping'
import { mapFitSport } from '../../server/import/fit/type-mapping'

describe('mapGpxActivityType', () => {
  it('matches unambiguous plain-text values case-insensitively', () => {
    expect(mapGpxActivityType('Cycling')).toBe('cycling')
    expect(mapGpxActivityType('RUN')).toBe('running')
    expect(mapGpxActivityType('hike')).toBe('hiking')
  })
  it('falls back to "other" for vendor-specific numeric codes rather than guessing', () => {
    expect(mapGpxActivityType('9')).toBe('other')
    expect(mapGpxActivityType(undefined)).toBe('other')
  })
})

describe('mapTcxSport', () => {
  it('maps the two sport values TCX actually standardizes', () => {
    expect(mapTcxSport('Running')).toBe('running')
    expect(mapTcxSport('Biking')).toBe('cycling')
  })
  it('reports "other" for anything outside the schema, including hiking/walking/swimming', () => {
    expect(mapTcxSport('Other')).toBe('other')
    expect(mapTcxSport('Hiking')).toBe('other')
    expect(mapTcxSport(undefined)).toBe('other')
  })
})

describe('mapFitSport', () => {
  it('trusts the FIT profile sport enum directly', () => {
    expect(mapFitSport('running')).toBe('running')
    expect(mapFitSport('cycling')).toBe('cycling')
    expect(mapFitSport('swimming')).toBe('swimming')
    expect(mapFitSport('hiking')).toBe('hiking')
    expect(mapFitSport('walking')).toBe('walking')
  })
  it('falls back to "other" for sports outside our activity type set', () => {
    expect(mapFitSport('motorcycling')).toBe('other')
    expect(mapFitSport(undefined)).toBe('other')
  })
})
