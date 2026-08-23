import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { serverConfig } from '../config'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

// APP_SECRET can be any length/format — hash it down to a fixed 32-byte key
// rather than requiring operators to produce exactly-sized key material.
function deriveKey(): Buffer {
  if (!serverConfig.appSecret) {
    throw new Error('APP_SECRET is not set — required to store encrypted secrets like an Immich API key')
  }
  return createHash('sha256').update(serverConfig.appSecret).digest()
}

/** iv + authTag + ciphertext, base64-joined with ':' so it round-trips through a single text column. */
export function encryptSecret(plain: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join(':')
}

export function decryptSecret(encoded: string): string {
  const key = deriveKey()
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return plain.toString('utf8')
}
