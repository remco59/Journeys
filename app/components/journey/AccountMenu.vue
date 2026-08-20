<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))

async function onLogout() {
  open.value = false
  await auth.logout()
  await navigateTo('/login')
}

const initial = computed(() => (auth.user?.username?.[0] ?? '?').toUpperCase())
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-paper-raised) font-mono text-xs font-medium text-(--color-ink-soft) transition hover:text-(--color-ink)"
      aria-label="Account menu"
      @click="open = !open"
    >
      {{ initial }}
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-xl bg-(--color-paper-raised) py-1 shadow-[0_10px_28px_rgba(20,26,32,0.16)]"
    >
      <p class="truncate px-4 py-2 font-mono text-xs text-(--color-ink-soft)">{{ auth.user?.username }}</p>
      <NuxtLink
        v-if="auth.user?.role === 'admin'"
        to="/admin/users"
        class="block px-4 py-2 text-sm text-(--color-ink) hover:bg-(--color-line)"
        @click="open = false"
      >
        Users
      </NuxtLink>
      <NuxtLink
        to="/settings"
        class="block px-4 py-2 text-sm text-(--color-ink) hover:bg-(--color-line)"
        @click="open = false"
      >
        Settings
      </NuxtLink>
      <button
        type="button"
        class="block w-full px-4 py-2 text-left text-sm text-(--color-ink) hover:bg-(--color-line)"
        @click="onLogout"
      >
        Sign out
      </button>
    </div>
  </div>
</template>
