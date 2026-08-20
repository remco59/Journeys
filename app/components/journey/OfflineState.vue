<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string
  }>(),
  { message: "Check your connection and try again." }
)
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-16 text-center">
    <svg
      class="size-10 text-(--color-stone)"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M8.5 8.5a5 5 0 0 1 7 0" />
      <path d="M5.5 5.5a9 9 0 0 1 13 0" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
    <h2 class="font-(family-name:--font-display) text-lg font-medium">Can't reach Journeys</h2>
    <p class="max-w-xs text-sm text-(--color-ink-soft)">{{ message }}</p>
    <button type="button" class="btn-primary mt-2" @click="emit('retry')">Retry</button>
  </div>
</template>
