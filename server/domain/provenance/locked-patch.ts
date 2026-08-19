/**
 * Drops any key present in lockedFields from a proposed patch. This is the
 * single mechanism that lets automatic reprocessing coexist with manual
 * edits: a locked field is never overwritten, no matter what the algorithm
 * proposes next time it runs. See architecture plan §12.
 */
export function pickUnlockedFields<T extends Record<string, unknown>>(
  proposed: Partial<T>,
  lockedFields: readonly string[]
): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(proposed) as (keyof T)[]) {
    if (lockedFields.includes(key as string)) continue
    patch[key] = proposed[key]
  }
  return patch
}
