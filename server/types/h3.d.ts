import type { SessionUser } from '../domain/auth/session'

declare module 'h3' {
  interface H3EventContext {
    user: SessionUser | null
  }
}

export {}
