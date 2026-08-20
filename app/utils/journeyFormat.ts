/** Inclusive day count: Aug 17 - Aug 21 is a 5 day trip, not 4. */
export function journeyDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

/** "AUGUST 2026" — for journeys spanning multiple months, the start month is shown. */
export function journeyMonthYearLabel(startDate: string): string {
  return new Date(startDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDistanceKm(meters: number): string {
  const km = meters / 1000
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
}

export function formatDistance(meters: number, unit: 'km' | 'mi'): string {
  if (unit === 'km') return formatDistanceKm(meters)
  const mi = meters / 1609.344
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi).toLocaleString()} mi`
}

/** "9h ago", "2d ago", "just now" — coarse relative time for card metadata. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}
