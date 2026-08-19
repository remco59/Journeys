<script setup lang="ts">
type Activity = {
  id: string
  title: string
  type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
}

const emit = defineEmits<{ saved: []; deleted: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const activity = ref<Activity | null>(null)
const title = ref('')
const type = ref<Activity['type']>('other')
const error = ref<string | null>(null)
const submitting = ref(false)

function open(a: Activity) {
  error.value = null
  activity.value = a
  title.value = a.title
  type.value = a.type
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

async function onSubmit() {
  if (!activity.value) return
  error.value = null
  submitting.value = true
  try {
    await $fetch(`/api/activities/${activity.value.id}`, { method: 'PATCH', body: { title: title.value, type: type.value } })
    close()
    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not save changes.'
  } finally {
    submitting.value = false
  }
}

async function onDelete() {
  if (!activity.value) return
  if (!confirm('Delete this activity? This cannot be undone.')) return
  await $fetch(`/api/activities/${activity.value.id}`, { method: 'DELETE' })
  close()
  emit('deleted')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="w-[26rem] max-w-[90vw] rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-0 text-(--color-ink) backdrop:bg-black/30"
  >
    <form v-if="activity" class="flex flex-col gap-3 p-6" @submit.prevent="onSubmit">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">Edit activity</h2>

      <label class="flex flex-col gap-1 text-sm">
        Title
        <input v-model="title" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        Type
        <select v-model="type" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2">
          <option value="cycling">Cycling</option>
          <option value="hiking">Hiking</option>
          <option value="running">Running</option>
          <option value="walking">Walking</option>
          <option value="swimming">Swimming</option>
          <option value="other">Other</option>
        </select>
      </label>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="mt-1 flex items-center justify-between">
        <button type="button" class="text-sm text-red-600 hover:text-red-700" @click="onDelete">Delete</button>
        <div class="flex gap-2">
          <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="close">Cancel</button>
          <button type="submit" :disabled="submitting" class="rounded-lg bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper) disabled:opacity-60">
            {{ submitting ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </form>
  </dialog>
</template>
