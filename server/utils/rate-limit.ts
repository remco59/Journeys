const buckets = new Map<string, number[]>()

/**
 * Minimal in-memory sliding-window limiter. Good enough for a single-replica,
 * single-household deployment; not distributed-safe, which is fine at this scale.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  hits.push(now)
  buckets.set(key, hits)
  return hits.length <= limit
}
