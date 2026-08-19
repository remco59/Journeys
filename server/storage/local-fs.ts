import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { StorageAdapter } from './types'

export class LocalFsStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const normalized = path.normalize(key).replace(/^([./\\]+)/, '')
    const full = path.join(this.rootDir, normalized)
    if (!full.startsWith(path.resolve(this.rootDir))) {
      throw new Error(`Refusing to resolve storage key outside root: ${key}`)
    }
    return full
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, data)
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key))
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local driver never exposes a stable public URL — every read goes
    // through the session/token-checked /api/files route (§17, §19).
    return `/api/files/${encodeURIComponent(key)}`
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true })
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key))
      return true
    } catch {
      return false
    }
  }
}
