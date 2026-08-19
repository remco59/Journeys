import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter } from './types'

export type S3Config = {
  endpoint?: string
  region?: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
}

/** Works unchanged against AWS S3, Cloudflare R2, or MinIO — all speak the S3 API. */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: S3Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region || 'auto',
      endpoint: config.endpoint,
      forcePathStyle: !!config.endpoint,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined
    })
  }

  async put(key: string, data: Buffer, opts?: { contentType?: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: opts?.contentType })
    )
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async getSignedUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string> {
    return presign(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: opts?.expiresInSeconds ?? 300
    })
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }
}
