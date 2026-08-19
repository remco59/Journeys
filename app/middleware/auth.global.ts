import { useAuthStore } from '../stores/auth'

const PUBLIC_ROUTES = new Set(['/login'])

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/shared/')) return
  if (PUBLIC_ROUTES.has(to.path)) return

  const auth = useAuthStore()
  if (!auth.loaded) {
    await auth.fetchSession()
  }
  if (!auth.user) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
