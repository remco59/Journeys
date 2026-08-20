<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
if (auth.user && auth.user.role !== 'admin') {
  throw createError({ statusCode: 403, statusMessage: 'Admins only' })
}

const { data: users, refresh } = await useFetch('/api/admin/users')

const username = ref('')
const password = ref('')
const role = ref<'admin' | 'user'>('user')
const error = ref<string | null>(null)
const submitting = ref(false)

async function createUser() {
  error.value = null
  submitting.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: { username: username.value, password: password.value, role: role.value }
    })
    username.value = ''
    password.value = ''
    role.value = 'user'
    await refresh()
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not create user.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-2xl bg-(--color-paper) px-6 py-10">
    <JourneyBackButton />
    <p class="eyebrow mt-4 text-(--color-ink-soft)">Admin</p>
    <h1 class="mt-1 font-(family-name:--font-display) text-2xl font-medium">Users</h1>

    <div class="mt-6 overflow-hidden rounded-2xl bg-(--color-paper-raised) shadow-[0_4px_14px_rgba(20,26,32,0.06)]">
      <table class="w-full border-collapse">
        <thead>
          <tr class="eyebrow text-(--color-ink-soft)">
            <th class="border-b border-(--color-line) px-4 py-3 text-left font-medium">Username</th>
            <th class="border-b border-(--color-line) px-4 py-3 text-left font-medium">Role</th>
            <th class="border-b border-(--color-line) px-4 py-3 text-left font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="border-b border-(--color-line) px-4 py-3 text-sm">{{ u.username }}</td>
            <td class="border-b border-(--color-line) px-4 py-3 font-mono text-xs text-(--color-ink-soft)">{{ u.role }}</td>
            <td class="border-b border-(--color-line) px-4 py-3 font-mono text-xs text-(--color-ink-soft)">
              {{ new Date(u.createdAt).toLocaleDateString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="mt-10 font-(family-name:--font-display) text-lg font-medium">Create user</h2>
    <form class="mt-3 flex max-w-xs flex-col gap-3" @submit.prevent="createUser">
      <input
        v-model="username"
        placeholder="Username"
        required
        class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm"
      />
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        required
        minlength="8"
        class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm"
      />
      <select v-model="role" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2 text-sm">
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <p v-if="error" class="m-0 text-sm text-(--color-brick)">{{ error }}</p>
      <button type="submit" :disabled="submitting" class="btn-primary self-start">
        {{ submitting ? 'Creating…' : 'Create user' }}
      </button>
    </form>
  </main>
</template>
