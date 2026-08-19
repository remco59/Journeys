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
  <main style="max-width: 40rem; margin: 2rem auto; font-family: system-ui;">
    <h1>Users</h1>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
      <thead>
        <tr>
          <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 0.4rem;">Username</th>
          <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 0.4rem;">Role</th>
          <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 0.4rem;">Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td style="padding: 0.4rem; border-bottom: 1px solid #f0f0f0;">{{ u.username }}</td>
          <td style="padding: 0.4rem; border-bottom: 1px solid #f0f0f0;">{{ u.role }}</td>
          <td style="padding: 0.4rem; border-bottom: 1px solid #f0f0f0;">{{ new Date(u.createdAt).toLocaleDateString() }}</td>
        </tr>
      </tbody>
    </table>

    <h2>Create user</h2>
    <form @submit.prevent="createUser" style="display: flex; flex-direction: column; gap: 0.6rem; max-width: 20rem;">
      <input v-model="username" placeholder="Username" required />
      <input v-model="password" type="password" placeholder="Password" required minlength="8" />
      <select v-model="role">
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <p v-if="error" style="color:#b3261e; margin:0;">{{ error }}</p>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Creating…' : 'Create user' }}</button>
    </form>
  </main>
</template>
