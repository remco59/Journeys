<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', destructive: false }
)
const emit = defineEmits<{ confirm: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
function open() {
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
function onConfirm() {
  close()
  emit('confirm')
}
defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="sheet" @click.self="close">
    <div class="sheet-handle" />
    <div class="flex flex-col gap-3 p-6 pt-2">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">{{ title }}</h2>
      <p v-if="message" class="text-sm text-(--color-ink-soft)">{{ message }}</p>
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="close">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-(--color-cream) transition"
          :style="{ background: destructive ? 'var(--color-brick)' : 'var(--color-teal)' }"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>
