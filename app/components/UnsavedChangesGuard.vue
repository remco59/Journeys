<script setup lang="ts">
withDefaults(defineProps<{ show: boolean; message?: string }>(), {
  message: 'Your changes will be lost.'
})
const emit = defineEmits<{ keep: []; discard: [] }>()
</script>

<template>
  <div v-if="show" class="absolute inset-0 z-10 flex flex-col justify-end rounded-[inherit] bg-(--color-paper)/97 backdrop-blur-sm">
    <div class="flex flex-col gap-3 p-6">
      <h3 class="font-(family-name:--font-display) text-lg font-medium">Discard changes?</h3>
      <p class="text-sm text-(--color-ink-soft)">{{ message }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="emit('keep')">Keep editing</button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-(--color-cream) transition"
          style="background: var(--color-brick)"
          @click="emit('discard')"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
</template>
