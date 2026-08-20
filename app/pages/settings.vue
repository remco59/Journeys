<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import type { ThemePreference } from '../composables/useTheme'

const auth = useAuthStore()
const { preference: themePreference, setPreference: setThemePreference } = useTheme()

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

const distanceUnit = ref(auth.user?.distanceUnit ?? 'km')
const unitsSaving = ref(false)

async function setDistanceUnit(unit: 'km' | 'mi') {
  if (unit === distanceUnit.value) return
  distanceUnit.value = unit
  unitsSaving.value = true
  try {
    await $fetch('/api/settings', { method: 'PATCH', body: { distanceUnit: unit } })
    if (auth.user) auth.user.distanceUnit = unit
  } finally {
    unitsSaving.value = false
  }
}

const username = ref(auth.user?.username ?? '')
const usernameError = ref<string | null>(null)
const usernameSuccess = ref(false)
const usernameSubmitting = ref(false)

async function saveUsername() {
  usernameError.value = null
  usernameSuccess.value = false
  usernameSubmitting.value = true
  try {
    const updated = await $fetch<{ id: string; username: string }>('/api/account/username', {
      method: 'PATCH',
      body: { username: username.value }
    })
    if (auth.user) auth.user.username = updated.username
    usernameSuccess.value = true
  } catch (err: any) {
    usernameError.value = err?.data?.statusMessage ?? 'Could not update username.'
  } finally {
    usernameSubmitting.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref<string | null>(null)
const passwordSuccess = ref(false)
const passwordSubmitting = ref(false)

async function savePassword() {
  passwordError.value = null
  passwordSuccess.value = false
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New passwords do not match.'
    return
  }
  passwordSubmitting.value = true
  try {
    await $fetch('/api/account/password', {
      method: 'PATCH',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordSuccess.value = true
  } catch (err: any) {
    passwordError.value = err?.data?.statusMessage ?? 'Could not update password.'
  } finally {
    passwordSubmitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-2xl bg-(--color-paper) px-6 py-10">
    <JourneyBackButton />
    <p class="eyebrow mt-4 text-(--color-ink-soft)">Account</p>
    <h1 class="mt-1 font-(family-name:--font-display) text-2xl font-medium">Settings</h1>

    <section class="mt-8 rounded-3xl bg-(--color-paper-raised) p-6">
      <h2 class="font-(family-name:--font-display) text-lg font-medium">Appearance</h2>
      <p class="mt-1 text-sm text-(--color-ink-soft)">Choose how Journeys looks on this account.</p>
      <div class="mt-4 flex gap-2">
        <button
          v-for="option in THEME_OPTIONS"
          :key="option.value"
          type="button"
          class="btn-chip"
          :class="themePreference === option.value ? '!bg-(--color-teal) !text-(--color-cream)' : ''"
          @click="setThemePreference(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <section class="mt-6 rounded-3xl bg-(--color-paper-raised) p-6">
      <h2 class="font-(family-name:--font-display) text-lg font-medium">Units</h2>
      <p class="mt-1 text-sm text-(--color-ink-soft)">Distance shown across your journeys.</p>
      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="btn-chip"
          :class="distanceUnit === 'km' ? '!bg-(--color-teal) !text-(--color-cream)' : ''"
          @click="setDistanceUnit('km')"
        >
          Kilometers
        </button>
        <button
          type="button"
          class="btn-chip"
          :class="distanceUnit === 'mi' ? '!bg-(--color-teal) !text-(--color-cream)' : ''"
          @click="setDistanceUnit('mi')"
        >
          Miles
        </button>
      </div>
    </section>

    <section class="mt-6 rounded-3xl bg-(--color-paper-raised) p-6">
      <h2 class="font-(family-name:--font-display) text-lg font-medium">Account</h2>

      <form class="mt-4 flex max-w-xs flex-col gap-3" @submit.prevent="saveUsername">
        <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
          Username
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            required
            class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm text-(--color-ink)"
          />
        </label>
        <p v-if="usernameError" class="m-0 text-sm text-(--color-brick)">{{ usernameError }}</p>
        <p v-else-if="usernameSuccess" class="m-0 text-sm text-(--color-teal)">Username updated.</p>
        <button type="submit" :disabled="usernameSubmitting" class="btn-primary self-start">
          {{ usernameSubmitting ? 'Saving…' : 'Save username' }}
        </button>
      </form>

      <form class="mt-8 flex max-w-xs flex-col gap-3" @submit.prevent="savePassword">
        <h3 class="text-sm font-medium text-(--color-ink)">Change password</h3>
        <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
          Current password
          <input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm text-(--color-ink)"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
          New password
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm text-(--color-ink)"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-(--color-ink-soft)">
          Confirm new password
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm text-(--color-ink)"
          />
        </label>
        <p v-if="passwordError" class="m-0 text-sm text-(--color-brick)">{{ passwordError }}</p>
        <p v-else-if="passwordSuccess" class="m-0 text-sm text-(--color-teal)">Password updated.</p>
        <button type="submit" :disabled="passwordSubmitting" class="btn-primary self-start">
          {{ passwordSubmitting ? 'Saving…' : 'Change password' }}
        </button>
      </form>
    </section>
  </main>
</template>
