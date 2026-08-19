import { defineStore } from 'pinia'

export type AuthUser = {
  id: string
  username: string
  role: 'admin' | 'user'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    loaded: false
  }),
  actions: {
    async fetchSession() {
      // Plain $fetch on the server doesn't forward the incoming request's
      // cookies, so SSR would never see an already-authenticated session.
      const requestFetch = import.meta.server ? useRequestFetch() : $fetch
      const response = await requestFetch<{ user: AuthUser | null }>('/api/auth/session')
      this.user = response.user
      this.loaded = true
      return this.user
    },
    async login(username: string, password: string) {
      const user = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      this.user = user as AuthUser
      this.loaded = true
      return this.user
    },
    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' })
      this.user = null
    }
  }
})
