<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const { data: journeys, refresh } = await useFetch('/api/journeys')

const createDialog = ref<{ open: () => void } | null>(null)

async function onLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-(--color-paper)">
    <header class="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
      <h1 class="font-(family-name:--font-display) text-2xl font-medium">Journeys</h1>
      <div class="flex items-center gap-4 text-sm text-(--color-ink-soft)">
        <NuxtLink v-if="auth.user?.role === 'admin'" to="/admin/users" class="hover:text-(--color-ink)">Users</NuxtLink>
        <span>{{ auth.user?.username }}</span>
        <button class="hover:text-(--color-ink)" @click="onLogout">Sign out</button>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 pb-16">
      <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-(--color-ink-soft)">{{ journeys?.length ?? 0 }} journeys</p>
        <button
          class="rounded-lg bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper)"
          @click="createDialog?.open()"
        >
          New journey
        </button>
      </div>

      <div v-if="journeys?.length" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <JourneyCard v-for="journey in journeys" :key="journey.id" :journey="journey" />
      </div>
      <div v-else class="rounded-2xl border border-dashed border-(--color-line) py-20 text-center text-(--color-ink-soft)">
        No journeys yet. Create your first one to get started.
      </div>
    </main>

    <ClientOnly>
      <JourneyCreateJourneyDialog ref="createDialog" @created="refresh" />
    </ClientOnly>
  </div>
</template>
