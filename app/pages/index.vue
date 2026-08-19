<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

async function onLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <main style="padding: 2rem; font-family: system-ui;">
    <h1>Journeys</h1>
    <p v-if="auth.user">
      Signed in as <strong>{{ auth.user.username }}</strong> ({{ auth.user.role }}).
    </p>
    <p>
      <NuxtLink v-if="auth.user?.role === 'admin'" to="/admin/users">Manage users</NuxtLink>
    </p>
    <button @click="onLogout">Sign out</button>
  </main>
</template>
