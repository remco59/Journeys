import { useAuthStore } from '../stores/auth'

export type ThemePreference = 'light' | 'dark' | 'system'

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * The `theme` cookie always holds a resolved, concrete value ('light'/'dark',
 * never 'system') so SSR can render the right <html class> on the first byte
 * with no flash — including for anonymous /shared/:token viewers who have no
 * account at all. `preference` (the 3-way choice, persisted server-side for
 * logged-in users) only decides how that cookie gets kept in sync.
 */
export function useTheme() {
  const auth = useAuthStore()
  const cookie = useCookie<'light' | 'dark'>('theme', {
    default: () => 'light',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })

  const preference = useState<ThemePreference>('theme-preference', () => auth.user?.theme ?? 'system')

  if (import.meta.client) {
    cookie.value = resolve(preference.value)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      if (preference.value === 'system') cookie.value = resolve('system')
    }
    mediaQuery.addEventListener('change', onSystemChange)
    onScopeDispose(() => mediaQuery.removeEventListener('change', onSystemChange))

    watch(preference, (pref) => {
      cookie.value = resolve(pref)
    })
  }

  useHead({ htmlAttrs: { class: computed(() => (cookie.value === 'dark' ? 'dark' : '')) } })

  async function setPreference(next: ThemePreference) {
    preference.value = next
    if (auth.user) {
      auth.user.theme = next
      try {
        await $fetch('/api/settings', { method: 'PATCH', body: { theme: next } })
      } catch {
        // Best-effort sync to the server; local + cookie state already updated.
      }
    }
  }

  return { preference, setPreference }
}
