import { loginSchema } from '../../../shared/types/auth'
import { findUserByUsername } from '../../domain/auth/users'
import { verifyPassword } from '../../domain/auth/password'
import { createSession } from '../../domain/auth/session'

// A valid-format argon2id hash with no matching password, used to keep the
// verify() timing similar whether or not the username actually exists.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Q6proueRP1Fs93EYU1kSuw'

// Strict in production; generous outside it so a dev/test loop logging in
// repeatedly against a long-lived local server doesn't trip its own limiter.
const LOGIN_LIMIT = process.env.NODE_ENV === 'production' ? 10 : 1000

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(`login:${ip}`, LOGIN_LIMIT, 5 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many login attempts, try again shortly' })
  }

  const body = await readValidatedBody(event, loginSchema.parse)
  const user = await findUserByUsername(body.username)
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, body.password)

  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  const config = useRuntimeConfig(event)
  const session = await createSession(user.id, config.sessionTtlDays)

  setCookie(event, config.sessionCookieName, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt
  })

  return { id: user.id, username: user.username, role: user.role }
})
