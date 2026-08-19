import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:3000'
const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'change-me-now'

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) throw new Error('Expected a Set-Cookie header')
  return raw.split(';')[0]
}

async function loginCookie(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) throw new Error(`login failed for ${username}: ${res.status}`)
  return extractSessionCookie(res)
}

async function createUser(adminCookie: string, username: string) {
  const res = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ username, password: 'a-fine-password', role: 'user' })
  })
  if (!res.ok) throw new Error(`user creation failed: ${res.status}`)
}

beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/health`).catch(() => null)
  if (!res || !res.ok) {
    throw new Error(`Dev stack not reachable at ${BASE_URL} — run "docker compose up -d" first.`)
  }
})

describe('journeys CRUD (live stack)', () => {
  it('creates, lists, updates, and deletes a journey for the owning user', async () => {
    const adminCookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)

    const createRes = await fetch(`${BASE_URL}/api/journeys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ title: 'Italy 2026', startDate: '2026-08-17', endDate: '2026-08-21' })
    })
    expect(createRes.status).toBe(201)
    const journey = await createRes.json()
    expect(journey.title).toBe('Italy 2026')

    const listRes = await fetch(`${BASE_URL}/api/journeys`, { headers: { cookie: adminCookie } })
    const list = await listRes.json()
    expect(list.some((j: any) => j.id === journey.id)).toBe(true)

    const patchRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ title: 'Northern Italy 2026' })
    })
    expect(patchRes.status).toBe(200)
    expect((await patchRes.json()).title).toBe('Northern Italy 2026')

    const deleteRes = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie }
    })
    expect(deleteRes.status).toBe(200)
  })

  it('never lets one user read, edit, or delete another user\'s journey', async () => {
    const adminCookie = await loginCookie(ADMIN_USERNAME, ADMIN_PASSWORD)
    const ownerUsername = `owner-${Date.now()}`
    const otherUsername = `other-${Date.now()}`
    await createUser(adminCookie, ownerUsername)
    await createUser(adminCookie, otherUsername)

    const ownerCookie = await loginCookie(ownerUsername, 'a-fine-password')
    const otherCookie = await loginCookie(otherUsername, 'a-fine-password')

    const createRes = await fetch(`${BASE_URL}/api/journeys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ title: 'Private Trip', startDate: '2026-01-01', endDate: '2026-01-02' })
    })
    const journey = await createRes.json()

    const readAsOther = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, { headers: { cookie: otherCookie } })
    expect(readAsOther.status).toBe(404)

    const patchAsOther = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: otherCookie },
      body: JSON.stringify({ title: 'Hijacked' })
    })
    expect(patchAsOther.status).toBe(404)

    const deleteAsOther = await fetch(`${BASE_URL}/api/journeys/${journey.id}`, {
      method: 'DELETE',
      headers: { cookie: otherCookie }
    })
    expect(deleteAsOther.status).toBe(404)

    const listAsOther = await fetch(`${BASE_URL}/api/journeys`, { headers: { cookie: otherCookie } })
    const otherList = await listAsOther.json()
    expect(otherList.some((j: any) => j.id === journey.id)).toBe(false)
  })
})
