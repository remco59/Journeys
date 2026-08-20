<script setup lang="ts">
type Photo = { id: string; storageKeyThumb: string | null }
type Activity = {
  id: string
  title: string
  type: 'cycling' | 'hiking' | 'running' | 'walking' | 'swimming' | 'other'
  coverPhotoId?: string | null
}

const props = defineProps<{ journeyId: string; photos: Photo[] }>()
const emit = defineEmits<{ saved: []; deleted: []; refreshPhotos: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const activity = ref<Activity | null>(null)
const title = ref('')
const type = ref<Activity['type']>('other')
const coverPhotoId = ref<string | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

const original = ref({ title: '', type: 'other' as Activity['type'], coverPhotoId: null as string | null })
const isDirty = () =>
  title.value !== original.value.title || type.value !== original.value.type || coverPhotoId.value !== original.value.coverPhotoId

function open(a: Activity) {
  error.value = null
  activity.value = a
  title.value = a.title
  type.value = a.type
  coverPhotoId.value = a.coverPhotoId ?? null
  original.value = { title: a.title, type: a.type, coverPhotoId: a.coverPhotoId ?? null }
  guard.reset()
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
const guard = useCloseGuard(isDirty, close)
defineExpose({ open })

async function onSubmit() {
  if (!activity.value) return
  error.value = null
  submitting.value = true
  try {
    await $fetch(`/api/activities/${activity.value.id}`, {
      method: 'PATCH',
      body: { title: title.value, type: type.value, coverPhotoId: coverPhotoId.value }
    })
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
  <dialog ref="dialog" class="sheet" @click.self="guard.requestClose" @cancel.prevent="guard.requestClose">
    <div class="sheet-handle" />
    <form v-if="activity" class="flex flex-col gap-3 p-6 pt-2" @submit.prevent="onSubmit">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Edit activity</h2>
        <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="guard.requestClose">✕</button>
      </div>

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

      <div class="flex flex-col gap-1 text-sm">
        Cover photo
        <PhotoPicker
          :journey-id="journeyId"
          :photos="photos"
          :selected-id="coverPhotoId"
          @update:selected-id="coverPhotoId = $event"
          @uploaded="emit('refreshPhotos')"
        />
      </div>

      <p v-if="error" class="text-sm text-(--color-brick)">{{ error }}</p>

      <div class="mt-1 flex items-center justify-between">
        <button type="button" class="text-sm text-(--color-brick) hover:opacity-75" @click="onDelete">Delete</button>
        <div class="flex gap-2">
          <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="guard.requestClose">Cancel</button>
          <button type="submit" :disabled="submitting" class="btn-primary">
            {{ submitting ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </form>
    <UnsavedChangesGuard :show="guard.confirmingClose.value" @keep="guard.cancelClose" @discard="guard.discardAndClose" />
  </dialog>
</template>
