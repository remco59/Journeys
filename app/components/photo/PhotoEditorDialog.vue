<script setup lang="ts">
type Photo = {
  id: string
  caption: string | null
  capturedAt: string | null
  locationSource: string
}

const emit = defineEmits<{ saved: []; deleted: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const photo = ref<Photo | null>(null)
const caption = ref('')
const capturedAtLocal = ref('')
const point = ref<{ lat: number; lon: number } | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function open(p: Photo, currentPoint: { lat: number; lon: number } | null) {
  error.value = null
  photo.value = p
  caption.value = p.caption ?? ''
  capturedAtLocal.value = toDatetimeLocal(p.capturedAt)
  point.value = currentPoint
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

async function onSubmit() {
  if (!photo.value) return
  error.value = null
  submitting.value = true
  try {
    const body: Record<string, unknown> = { caption: caption.value || null }
    if (capturedAtLocal.value) body.capturedAt = new Date(capturedAtLocal.value).toISOString()
    if (point.value) {
      body.lat = point.value.lat
      body.lon = point.value.lon
    }
    await $fetch(`/api/photos/${photo.value.id}`, { method: 'PATCH', body })
    close()
    emit('saved')
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not save changes.'
  } finally {
    submitting.value = false
  }
}

async function onSetCover() {
  if (!photo.value) return
  await $fetch(`/api/photos/${photo.value.id}/set-cover`, { method: 'POST' })
  emit('saved')
}

async function onDelete() {
  if (!photo.value) return
  if (!confirm('Delete this photo? This cannot be undone.')) return
  await $fetch(`/api/photos/${photo.value.id}`, { method: 'DELETE' })
  close()
  emit('deleted')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="w-[28rem] max-w-[90vw] rounded-2xl border border-(--color-line) bg-(--color-paper-raised) p-0 text-(--color-ink) backdrop:bg-black/30"
  >
    <form v-if="photo" class="flex flex-col gap-3 p-6" @submit.prevent="onSubmit">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Edit photo</h2>
        <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="close">✕</button>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        Caption
        <input v-model="caption" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" placeholder="Add a caption…" />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        Date &amp; time taken
        <input v-model="capturedAtLocal" type="datetime-local" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
      </label>

      <div class="flex flex-col gap-1 text-sm">
        <span class="flex items-center justify-between">
          Location
          <span v-if="photo.locationSource === 'unresolved'" class="text-xs text-(--color-gold)">No location detected</span>
        </span>
        <PhotoMapPointPicker v-model="point" />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="mt-1 flex items-center justify-between">
        <div class="flex gap-3 text-sm">
          <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="onSetCover">Set as cover</button>
          <button type="button" class="text-red-600 hover:text-red-700" @click="onDelete">Delete</button>
        </div>
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
