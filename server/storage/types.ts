export interface StorageAdapter {
  put(key: string, data: Buffer, opts?: { contentType?: string }): Promise<void>
  get(key: string): Promise<Buffer>
  getSignedUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
