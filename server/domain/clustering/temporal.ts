export type TemporalWindowOptions = {
  /** Floor for the gap threshold, regardless of how tightly-spaced the data is. */
  minGapMs?: number
  /** Adaptive threshold = max(minGapMs, gapMultiplier * medianIntervalMs). */
  gapMultiplier?: number
}

const DEFAULTS: Required<TemporalWindowOptions> = {
  minGapMs: 20 * 60 * 1000,
  gapMultiplier: 3
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * Splits a time-sorted sequence into windows wherever the gap to the next
 * item exceeds an adaptive threshold, so a sparsely-photographed museum
 * visit stays one window while a genuinely separate stop still splits.
 * See architecture plan §09, "Pass 1 — temporal windows".
 */
export function splitIntoTemporalWindows<T>(
  items: T[],
  getTime: (item: T) => number,
  opts: TemporalWindowOptions = {}
): T[][] {
  if (items.length === 0) return []
  const { minGapMs, gapMultiplier } = { ...DEFAULTS, ...opts }

  const sorted = [...items].sort((a, b) => getTime(a) - getTime(b))
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(getTime(sorted[i]!) - getTime(sorted[i - 1]!))
  }

  const threshold = Math.max(minGapMs, gapMultiplier * median(gaps))

  const windows: T[][] = []
  let current: T[] = [sorted[0]!]
  for (let i = 1; i < sorted.length; i++) {
    const gap = getTime(sorted[i]!) - getTime(sorted[i - 1]!)
    if (gap > threshold) {
      windows.push(current)
      current = []
    }
    current.push(sorted[i]!)
  }
  windows.push(current)
  return windows
}
