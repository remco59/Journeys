import { defineStore } from 'pinia'

export type AuthUser = {
  id: string
  username: string
  role: 'admin' | 'user'
  theme: 'light' | 'dark' | 'system'
  distanceUnit: 'km' | 'mi'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    loaded: false
  }),
  actions: {
    async fetchSession() {
      // Plain $fetch on the server doesn't forward the incoming request's
      // cookies, so SSR would never see an already-authenticated session —
      // forward them explicitly instead. (useRequestFetch() would do this
      // too, but its return type blows TS's recursion limit once the API
      // surface has this many dynamic routes — Excessive stack depth,
      // TS2321 — where plain $fetch does not.)
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const response = await $fetch<{ user: AuthUser | null }>('/api/auth/session', { headers })
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
