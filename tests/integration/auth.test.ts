import { describe, it, expect, beforeAll } from 'vitest'

// Exercises the real, running dev stack (docker compose up) end to end over
// HTTP. Requires the web container to be up and the bootstrap admin seeded.
const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'
const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'change-me-now'

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Expected a Set-Cookie header')
  return raw.split(';')[0]
}

async function login(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  return res
}

beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/health`).catch(() => null)
  if (!res || !res.ok) {
    throw new Error(`Dev stack not reachable at ${BASE_URL} — run "docker compose up -d" first.`)
  }
})

describe('auth flow (live stack)', () => {
  it('rejects an invalid login', async () => {
    const res = await login(ADMIN_USERNAME, 'definitely-wrong')
    expect(res.status).toBe(401)
  })

  it('logs the bootstrap admin in and returns a session cookie', async () => {
    const res = await login(ADMIN_USERNAME, ADMIN_PASSWORD)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.username).toBe(ADMIN_USERNAME)
    expect(body.role).toBe('admin')
    expect(res.headers.get('set-cookie')).toBeTruthy()
  })

  it('lets an admin create a user, and a non-admin is rejected from the admin route', async () => {
    const adminLogin = await login(ADMIN_USERNAME, ADMIN_PASSWORD)
    const adminCookie = extractSessionCookie(adminLogin)

    const newUsername = `test-user-${Date.now()}`
    const createRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ username: newUsername, password: 'a-fine-password', role: 'user' })
    })
    expect(createRes.status).toBe(201)

    const userLogin = await login(newUsername, 'a-fine-password')
    expect(userLogin.status).toBe(200)
    const userCookie = extractSessionCookie(userLogin)

    const forbidden = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { cookie: userCookie }
    })
    expect(forbidden.status).toBe(403)
  })

  it('rejects the admin route with no session at all', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`)
    expect(res.status).toBe(401)
  })
})
