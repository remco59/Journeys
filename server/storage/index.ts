import { LocalFsStorageAdapter } from './local-fs'
import { S3StorageAdapter } from './s3'
import type { StorageAdapter } from './types'
import { serverConfig } from '../config'

export type { StorageAdapter } from './types'

let adapter: StorageAdapter | undefined

export function getStorage(): StorageAdapter {
  if (adapter) return adapter

  const config = serverConfig
  if (config.storageDriver === 's3') {
    if (!config.s3.bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3')
    adapter = new S3StorageAdapter({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      bucket: config.s3.bucket,
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey
    })
  } else {
    adapter = new LocalFsStorageAdapter(config.localStoragePath)
  }
  return adapter
}
