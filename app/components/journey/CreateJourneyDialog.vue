<script setup lang="ts">
const emit = defineEmits<{ created: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const title = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

function open() {
  error.value = null
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await $fetch('/api/journeys', {
      method: 'POST',
      body: {
        title: title.value,
        description: description.value || undefined,
        startDate: startDate.value,
        endDate: endDate.value
      }
    })
    title.value = ''
    description.value = ''
    startDate.value = ''
    endDate.value = ''
    close()
    emit('created')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not create journey.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <dialog ref="dialog" class="w-[26rem] max-w-[90vw] rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-0 text-(--color-ink) backdrop:bg-black/30">
    <form class="flex flex-col gap-3 p-6" @submit.prevent="onSubmit">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">New journey</h2>

      <label class="flex flex-col gap-1 text-sm">
        Title
        <input v-model="title" required placeholder="Italy 2026" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        Description
        <textarea v-model="description" rows="2" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <div class="flex gap-3">
        <label class="flex flex-1 flex-col gap-1 text-sm">
          Start date
          <input v-model="startDate" type="date" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
        <label class="flex flex-1 flex-col gap-1 text-sm">
          End date
          <input v-model="endDate" type="date" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="close">Cancel</button>
        <button type="submit" :disabled="submitting" class="rounded-lg bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper) disabled:opacity-60">
          {{ submitting ? 'Creating…' : 'Create journey' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
