export type DbscanOptions<T> = {
  eps: number
  minPts: number
  distance: (a: T, b: T) => number
}

/**
 * Generic DBSCAN. Returns one label per input point: -1 for noise,
 * otherwise a 0-indexed cluster id. With minPts=1 every point always
 * belongs to a cluster (a lone point becomes a singleton cluster) —
 * that's what the section-clustering pipeline uses, since no photo
 * should ever be silently dropped as "noise" (see §09).
 */
export function dbscan<T>(points: T[], opts: DbscanOptions<T>): number[] {
  const n = points.length
  const UNVISITED = -2
  const NOISE = -1
  const labels: number[] = new Array(n).fill(UNVISITED)
  const visited: boolean[] = new Array(n).fill(false)

  function regionQuery(idx: number): number[] {
    const neighbors: number[] = []
    for (let j = 0; j < n; j++) {
      if (opts.distance(points[idx]!, points[j]!) <= opts.eps) neighbors.push(j)
    }
    return neighbors
  }

  let clusterId = 0
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    visited[i] = true

    const neighbors = regionQuery(i)
    if (neighbors.length < opts.minPts) {
      labels[i] = NOISE
      continue
    }

    labels[i] = clusterId
    const seedSet = new Set<number>(neighbors)
    const seedQueue = [...neighbors]

    for (let k = 0; k < seedQueue.length; k++) {
      const j = seedQueue[k]!
      if (!visited[j]) {
        visited[j] = true
        const jNeighbors = regionQuery(j)
        if (jNeighbors.length >= opts.minPts) {
          for (const cand of jNeighbors) {
            if (!seedSet.has(cand)) {
              seedSet.add(cand)
              seedQueue.push(cand)
            }
          }
        }
      }
      if (labels[j] === UNVISITED || labels[j] === NOISE) {
        labels[j] = clusterId
      }
    }
    clusterId++
  }

  return labels
}
