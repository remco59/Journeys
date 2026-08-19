import { DateTime } from 'luxon'

/** Inclusive day count: Aug 17 - Aug 21 is a 5 day trip, not 4. */
export function journeyDurationDays(startDate: string, endDate: string): number {
  const start = DateTime.fromISO(startDate)
  const end = DateTime.fromISO(endDate)
  return Math.floor(end.diff(start, 'days').days) + 1
}

/** "August 2026" — for journeys spanning multiple months, the start month is shown. */
export function journeyMonthYearLabel(startDate: string): string {
  return DateTime.fromISO(startDate).toFormat('LLLL yyyy')
}
