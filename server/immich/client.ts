export type ImmichAsset = {
  id: string
  originalFileName: string
  fileCreatedAt: string
}

export type ImmichAlbum = {
  id: string
  albumName: string
  assetCount: number
}

/**
 * Thin REST client for a self-hosted Immich instance, modeled on
 * server/geo/providers/photon.ts. Every call carries the user's own
 * baseUrl/apiKey (see server/domain/integrations/immich.ts) — nothing here
 * is global config, unlike the geo providers.
 */
export class ImmichClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private headers(accept = 'application/json') {
    return { 'x-api-key': this.apiKey, accept }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/server/ping`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async listAlbums(): Promise<ImmichAlbum[]> {
    const res = await fetch(`${this.baseUrl}/api/albums`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Immich listAlbums failed: ${res.status}`)
    return res.json()
  }

  async getAlbumAssets(albumId: string): Promise<ImmichAsset[]> {
    const res = await fetch(`${this.baseUrl}/api/albums/${albumId}`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Immich getAlbumAssets failed: ${res.status}`)
    const body = (await res.json()) as { assets: ImmichAsset[] }
    return body.assets
  }

  async searchByDateRange(from: string, to: string): Promise<ImmichAsset[]> {
    const res = await fetch(`${this.baseUrl}/api/search/metadata`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'IMAGE', takenAfter: from, takenBefore: to, size: 200 }),
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) throw new Error(`Immich search failed: ${res.status}`)
    const body = (await res.json()) as { assets: { items: ImmichAsset[] } }
    return body.assets.items
  }

  async downloadOriginal(assetId: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/assets/${assetId}/original`, {
      headers: this.headers('*/*'),
      signal: AbortSignal.timeout(60_000)
    })
    if (!res.ok) throw new Error(`Immich downloadOriginal failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async getThumbnail(assetId: string): Promise<{ data: Buffer; contentType: string }> {
    const res = await fetch(`${this.baseUrl}/api/assets/${assetId}/thumbnail?size=thumbnail`, {
      headers: this.headers('image/*'),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) throw new Error(`Immich getThumbnail failed: ${res.status}`)
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/webp' }
  }
}
