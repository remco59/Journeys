import { describe, it, expect } from 'vitest'
import { journeyDurationDays, journeyMonthYearLabel } from '../../server/domain/journeys/summary'

describe('journeyDurationDays', () => {
  it('counts inclusively — same start and end is a 1 day trip', () => {
    expect(journeyDurationDays('2026-08-17', '2026-08-17')).toBe(1)
  })

  it('matches the brief\'s worked example: 5 days', () => {
    expect(journeyDurationDays('2026-08-17', '2026-08-21')).toBe(5)
  })

  it('handles a multi-week span', () => {
    expect(journeyDurationDays('2026-08-01', '2026-08-31')).toBe(31)
  })
})

describe('journeyMonthYearLabel', () => {
  it('formats as "Month Year"', () => {
    expect(journeyMonthYearLabel('2026-08-17')).toBe('August 2026')
  })
})
