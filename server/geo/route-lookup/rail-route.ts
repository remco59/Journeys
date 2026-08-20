import { and, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { routeCache } from '../../db/schema'
import { serverConfig } from '../../config'
import { haversineMeters, pathDistanceMeters, type LatLon } from '../../domain/clustering/geo-math'

export type RailRouteResult = { geom: LatLon[]; distanceM: number; reason: string }

const MAX_STRAIGHT_LINE_KM = 800 // beyond this it's not a realistic single rail trip — and already a flight candidate
const MAX_ENDPOINT_TO_RAIL_KM = 3 // reject if the nearest track is farther than this from either endpoint
const MAX_PATH_VS_STRAIGHT_LINE_RATIO = 2.5 // reject implausibly long paths — almost certainly a bad/disconnected match
const CACHE_PRECISION = 3 // ~111m grid cells, matching geocode.ts's cache-key convention
const FOUND_TTL_DAYS = 180 // rail networks change rarely
const NOT_FOUND_TTL_DAYS = 14
const PROVIDER = 'overpass'

type OverpassWay = { type: 'way'; id: number; nodes: number[]; geometry: { lat: number; lon: number }[] }
type OverpassResponse = { elements: OverpassWay[] }

function cacheKeyFor(from: LatLon, to: LatLon): string {
  const p = (v: number) => v.toFixed(CACHE_PRECISION)
  return `${p(from.lat)},${p(from.lon)}->${p(to.lat)},${p(to.lon)}`
}

async function readCache(key: string): Promise<{ found: false } | { found: true; result: RailRouteResult } | null> {
  const db = useDb()
  const rows = await db.select().from(routeCache).where(and(eq(routeCache.provider, PROVIDER), eq(routeCache.cacheKey, key))).limit(1)
  const hit = rows[0]
  if (!hit || hit.expiresAt.getTime() <= Date.now()) return null
  if (hit.found === 'no' || !hit.geom || hit.distanceM == null) return { found: false }
  return { found: true, result: { geom: hit.geom, distanceM: hit.distanceM, reason: railRouteReason } }
}

const railRouteReason = 'Snapped to real track geometry from OpenStreetMap'

async function writeCache(key: string, result: RailRouteResult | null): Promise<void> {
  const db = useDb()
  const ttlDays = result ? FOUND_TTL_DAYS : NOT_FOUND_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  await db
    .insert(routeCache)
    .values({
      provider: PROVIDER,
      cacheKey: key,
      found: result ? 'yes' : 'no',
      geom: result?.geom ?? null,
      distanceM: result?.distanceM ?? null,
      expiresAt
    })
    .onConflictDoUpdate({
      target: [routeCache.provider, routeCache.cacheKey],
      set: { found: result ? 'yes' : 'no', geom: result?.geom ?? null, distanceM: result?.distanceM ?? null, expiresAt, createdAt: new Date() }
    })
}

function boundingBox(from: LatLon, to: LatLon): { south: number; west: number; north: number; east: number } {
  const south = Math.min(from.lat, to.lat)
  const north = Math.max(from.lat, to.lat)
  const west = Math.min(from.lon, to.lon)
  const east = Math.max(from.lon, to.lon)
  // Pad proportionally to the leg's own size (so a short local gap still
  // gets a sensible search radius) with a floor so degenerate/near-identical
  // endpoints still query a usable area.
  const latPad = Math.max((north - south) * 0.25, 0.1)
  const lonPad = Math.max((east - west) * 0.25, 0.1)
  return { south: south - latPad, west: west - lonPad, north: north + latPad, east: east + lonPad }
}

async function queryOverpassRailWays(bbox: { south: number; west: number; north: number; east: number }): Promise<OverpassWay[]> {
  const query = `[out:json][timeout:20];way["railway"="rail"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out geom;`
  const res = await fetch(serverConfig.overpassBaseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'journeys-self-hosted-app (rail-route-lookup)' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok) throw new Error(`Overpass rail query failed: ${res.status}`)
  const body = (await res.json()) as OverpassResponse
  return body.elements.filter((e) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 2)
}

type Graph = { neighbors: Map<number, { to: number; weightM: number }[]>; coord: Map<number, LatLon> }

function buildGraph(ways: OverpassWay[]): Graph {
  const neighbors = new Map<number, { to: number; weightM: number }[]>()
  const coord = new Map<number, LatLon>()

  const addEdge = (a: number, b: number, weightM: number) => {
    if (!neighbors.has(a)) neighbors.set(a, [])
    neighbors.get(a)!.push({ to: b, weightM })
  }

  for (const way of ways) {
    for (let i = 0; i < way.nodes.length; i++) {
      const id = way.nodes[i]!
      const g = way.geometry[i]
      if (g && !coord.has(id)) coord.set(id, { lat: g.lat, lon: g.lon })
    }
    for (let i = 1; i < way.nodes.length; i++) {
      const a = way.nodes[i - 1]!
      const b = way.nodes[i]!
      const ca = coord.get(a)
      const cb = coord.get(b)
      if (!ca || !cb) continue
      const w = haversineMeters(ca, cb)
      addEdge(a, b, w)
      addEdge(b, a, w)
    }
  }

  return { neighbors, coord }
}

function nearestGraphNode(graph: Graph, point: LatLon, maxDistanceKm: number): number | null {
  let best: number | null = null
  let bestDistanceM = Infinity
  for (const [id, coord] of graph.coord) {
    const d = haversineMeters(point, coord)
    if (d < bestDistanceM) {
      bestDistanceM = d
      best = id
    }
  }
  return best !== null && bestDistanceM <= maxDistanceKm * 1000 ? best : null
}

/** Binary min-heap keyed by distance, for Dijkstra over graphs with tens of thousands of nodes. */
class MinHeap {
  private items: { id: number; dist: number }[] = []

  push(id: number, dist: number) {
    this.items.push({ id, dist })
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent]!.dist <= this.items[i]!.dist) break
      ;[this.items[parent], this.items[i]] = [this.items[i]!, this.items[parent]!]
      i = parent
    }
  }

  pop(): { id: number; dist: number } | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]!
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = i * 2 + 2
        let smallest = i
        if (l < this.items.length && this.items[l]!.dist < this.items[smallest]!.dist) smallest = l
        if (r < this.items.length && this.items[r]!.dist < this.items[smallest]!.dist) smallest = r
        if (smallest === i) break
        ;[this.items[smallest], this.items[i]] = [this.items[i]!, this.items[smallest]!]
        i = smallest
      }
    }
    return top
  }

  get size() {
    return this.items.length
  }
}

/** Shortest path (by track distance) between two graph nodes, or null if unreachable. Exported for direct testing against a synthetic graph. */
export function dijkstraPath(graph: Graph, startId: number, endId: number): number[] | null {
  const dist = new Map<number, number>([[startId, 0]])
  const prev = new Map<number, number>()
  const visited = new Set<number>()
  const heap = new MinHeap()
  heap.push(startId, 0)

  while (heap.size > 0) {
    const { id, dist: d } = heap.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    if (id === endId) break
    if (d > (dist.get(id) ?? Infinity)) continue

    for (const edge of graph.neighbors.get(id) ?? []) {
      const nd = d + edge.weightM
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd)
        prev.set(edge.to, id)
        heap.push(edge.to, nd)
      }
    }
  }

  if (!dist.has(endId)) return null

  const path: number[] = [endId]
  let cur = endId
  while (cur !== startId) {
    const p = prev.get(cur)
    if (p === undefined) return null
    path.push(p)
    cur = p
  }
  return path.reverse()
}

/** Builds a rail-network graph and finds the shortest track path between two nodes, for direct unit testing against a synthetic Overpass-shaped fixture. */
export function findRailPathInWays(ways: OverpassWay[], from: LatLon, to: LatLon): RailRouteResult | null {
  const graph = buildGraph(ways)
  const startId = nearestGraphNode(graph, from, MAX_ENDPOINT_TO_RAIL_KM)
  const endId = nearestGraphNode(graph, to, MAX_ENDPOINT_TO_RAIL_KM)
  if (startId === null || endId === null || startId === endId) return null

  const nodePath = dijkstraPath(graph, startId, endId)
  if (!nodePath) return null

  const geom: LatLon[] = [from, ...nodePath.map((id) => graph.coord.get(id)!), to]
  const distanceM = pathDistanceMeters(geom)
  const straightLineM = haversineMeters(from, to)
  if (distanceM > straightLineM * MAX_PATH_VS_STRAIGHT_LINE_RATIO) return null

  return { geom, distanceM, reason: railRouteReason }
}

/**
 * Finds a real rail route between two points using OpenStreetMap's Overpass
 * API: pulls railway=rail ways in a bbox around the two endpoints, builds a
 * node graph, and runs Dijkstra between the nearest track node to each
 * endpoint. Cached (rail networks rarely change; Overpass is rate-limited).
 * Any failure — network error, timeout, malformed response, no plausible
 * path — resolves to null rather than throwing, since this runs inside the
 * background clustering job and must never take it down.
 */
export async function findRailRoute(from: LatLon, to: LatLon): Promise<RailRouteResult | null> {
  if (haversineMeters(from, to) > MAX_STRAIGHT_LINE_KM * 1000) return null

  const key = cacheKeyFor(from, to)
  try {
    const cached = await readCache(key)
    if (cached) return cached.found ? cached.result : null

    const ways = await queryOverpassRailWays(boundingBox(from, to))
    const result = findRailPathInWays(ways, from, to)
    await writeCache(key, result)
    return result
  } catch {
    return null
  }
}
