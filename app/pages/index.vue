<script setup lang="ts">
const { data: health } = await useFetch('/api/health')
</script>

<template>
  <main style="padding: 2rem; font-family: system-ui;">
    <h1>Journeys</h1>
    <p>Scaffold running. API health: {{ health?.status ?? 'unknown' }}</p>
  </main>
</template>
