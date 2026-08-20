<script setup lang="ts">
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-4 rounded-[28px] bg-(--color-paper-raised) px-8 py-20 text-center sm:py-28">
    <h2 class="font-(family-name:--font-display) text-3xl font-medium text-(--color-ink) sm:text-4xl">
      Your next journey starts here
    </h2>
    <p class="max-w-sm text-sm text-(--color-ink-soft)">
      Add photos or import a GPS track and Journeys builds the story for you — places, days, and routes, laid out automatically.
    </p>
    <button type="button" class="btn-primary mt-2" @click="$emit('create')">Create journey</button>
  </div>
</template>
