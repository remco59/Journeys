import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from '../../server/utils/crypto'

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret value', () => {
    const encrypted = encryptSecret('my-immich-api-key')
    expect(decryptSecret(encrypted)).toBe('my-immich-api-key')
  })

  it('never stores the plaintext in the encrypted output', () => {
    const encrypted = encryptSecret('super-secret-value')
    expect(encrypted).not.toContain('super-secret-value')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a).not.toBe(b)
  })

  it('rejects a tampered ciphertext instead of silently returning garbage', () => {
    const encrypted = encryptSecret('my-immich-api-key')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    const tampered = [iv, authTag, Buffer.from('tampered').toString('base64')].join(':')
    void ciphertext
    expect(() => decryptSecret(tampered)).toThrow()
  })
})
