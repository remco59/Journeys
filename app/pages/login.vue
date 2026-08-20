<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await auth.login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect)
  } catch {
    error.value = 'Invalid username or password.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-(--color-paper) px-6">
    <form
      class="flex w-80 animate-fade-up flex-col gap-3 rounded-3xl bg-(--color-paper-raised) p-8 shadow-[0_10px_32px_rgba(20,26,32,0.12)]"
      @submit.prevent="onSubmit"
    >
      <h1 class="font-(family-name:--font-display) text-2xl font-medium">Journeys</h1>
      <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
        Username
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-(--color-ink)"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-(--color-ink)"
        />
      </label>
      <p v-if="error" class="m-0 text-sm text-(--color-brick)">{{ error }}</p>
      <button type="submit" :disabled="submitting" class="btn-primary mt-2">
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
