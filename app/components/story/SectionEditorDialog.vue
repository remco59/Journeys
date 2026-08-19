<script setup lang="ts">
const props = defineProps<{
  journeyId: string
  section?: { id: string; title: string; placeName: string | null; description: string | null } | null
}>()
const emit = defineEmits<{ saved: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const title = ref('')
const placeName = ref('')
const description = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

function open() {
  error.value = null
  title.value = props.section?.title ?? ''
  placeName.value = props.section?.placeName ?? ''
  description.value = props.section?.description ?? ''
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
    const body = { title: title.value, placeName: placeName.value || undefined, description: description.value || undefined }
    if (props.section) {
      await $fetch(`/api/sections/${props.section.id}`, { method: 'PATCH', body })
    } else {
      await $fetch(`/api/journeys/${props.journeyId}/sections`, { method: 'POST', body })
    }
    close()
    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not save section.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <dialog ref="dialog" class="w-[26rem] max-w-[90vw] rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-0 text-(--color-ink) backdrop:bg-black/30">
    <form class="flex flex-col gap-3 p-6" @submit.prevent="onSubmit">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">{{ section ? 'Edit section' : 'New section' }}</h2>

      <label class="flex flex-col gap-1 text-sm">
        Title
        <input v-model="title" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        Place name
        <input v-model="placeName" placeholder="Milano, Italy" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        Description
        <textarea v-model="description" rows="3" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="close">Cancel</button>
        <button type="submit" :disabled="submitting" class="rounded-lg bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper) disabled:opacity-60">
          {{ submitting ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
