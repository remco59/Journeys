<script setup lang="ts">
const emit = defineEmits<{ created: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const step = ref<'details' | 'photos'>('details')
const title = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const createdJourneyId = ref<string | null>(null)
const uploadedCount = ref(0)

function open() {
  error.value = null
  step.value = 'details'
  title.value = ''
  description.value = ''
  startDate.value = ''
  endDate.value = ''
  createdJourneyId.value = null
  uploadedCount.value = 0
  guard.reset()
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
// Once the journey is created (step 'photos'), it's already persisted — closing
// doesn't lose anything, so only the 'details' step needs the unsaved-changes guard.
const isDirty = () => step.value === 'details' && !!(title.value || description.value || startDate.value || endDate.value)
const guard = useCloseGuard(isDirty, close)
defineExpose({ open })

async function onSubmitDetails() {
  error.value = null
  submitting.value = true
  try {
    const journey = await $fetch<{ id: string }>('/api/journeys', {
      method: 'POST',
      body: {
        title: title.value,
        description: description.value || undefined,
        startDate: startDate.value,
        endDate: endDate.value
      }
    })
    createdJourneyId.value = journey.id
    emit('created')
    step.value = 'photos'
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not create journey.'
  } finally {
    submitting.value = false
  }
}

function onUploaded() {
  uploadedCount.value += 1
}

async function finish() {
  const id = createdJourneyId.value
  close()
  if (id) await navigateTo(`/journeys/${id}`)
}
</script>

<template>
  <dialog ref="dialog" class="sheet" @click.self="guard.requestClose" @cancel.prevent="guard.requestClose">
    <div class="sheet-handle" />
    <form v-if="step === 'details'" class="flex flex-col gap-3 p-6 pt-2" @submit.prevent="onSubmitDetails">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">New journey</h2>
      <p class="eyebrow text-(--color-ink-soft)">Step 1 of 2 — details</p>

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

      <p v-if="error" class="text-sm text-(--color-brick)">{{ error }}</p>

      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="guard.requestClose">Cancel</button>
        <button type="submit" :disabled="submitting" class="btn-primary">
          {{ submitting ? 'Creating…' : 'Next: add photos' }}
        </button>
      </div>
    </form>

    <div v-else-if="createdJourneyId" class="flex flex-col gap-3 p-6 pt-2">
      <h2 class="font-(family-name:--font-display) text-xl font-medium">Add photos</h2>
      <p class="eyebrow text-(--color-ink-soft)">Step 2 of 2 — "{{ title }}" was created. Upload photos now, or skip and add them later.</p>

      <PhotoUploader :journey-id="createdJourneyId" @uploaded="onUploaded" />

      <p v-if="uploadedCount" class="text-sm text-(--color-teal)">Photos uploaded — they'll appear in the Story once processed.</p>

      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="finish">
          {{ uploadedCount ? 'Done' : 'Skip for now' }}
        </button>
        <button type="button" class="btn-primary" @click="finish">Go to journey</button>
      </div>
    </div>
    <UnsavedChangesGuard :show="guard.confirmingClose.value" @keep="guard.cancelClose" @discard="guard.discardAndClose" />
  </dialog>
</template>
