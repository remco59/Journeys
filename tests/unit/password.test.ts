import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/domain/auth/password'

describe('password hashing', () => {
  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword(hash, 'wrong password')).toBe(false)
  })

  it('never stores the plaintext in the hash output', async () => {
    const hash = await hashPassword('super-secret-value')
    expect(hash).not.toContain('super-secret-value')
  })

  it('rejects gracefully against a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-real-hash', 'anything')).toBe(false)
  })
})
