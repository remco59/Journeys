<script setup lang="ts">
type Photo = {
  id: string
  caption: string | null
  capturedAt: string | null
  locationSource: string
  sectionId?: string | null
}

const props = withDefaults(defineProps<{ sections?: Array<{ id: string; title: string }> }>(), { sections: () => [] })
const emit = defineEmits<{ saved: []; deleted: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const photo = ref<Photo | null>(null)
const caption = ref('')
const capturedAtLocal = ref('')
const point = ref<{ lat: number; lon: number } | null>(null)
const sectionId = ref<string | ''>('')
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
  sectionId.value = p.sectionId ?? ''
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
    if (sectionId.value !== (photo.value.sectionId ?? '')) {
      body.sectionId = sectionId.value || null
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
  <dialog ref="dialog" class="sheet">
    <div class="sheet-handle" />
    <form v-if="photo" class="flex flex-col gap-3 p-6 pt-2" @submit.prevent="onSubmit">
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

      <label v-if="sections.length" class="flex flex-col gap-1 text-sm">
        Section
        <select v-model="sectionId" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2">
          <option value="">Unsorted</option>
          <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </label>

      <p v-if="error" class="text-sm text-(--color-brick)">{{ error }}</p>

      <div class="mt-1 flex items-center justify-between">
        <div class="flex gap-3 text-sm">
          <button type="button" class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="onSetCover">Set as cover</button>
          <button type="button" class="text-(--color-brick) hover:opacity-75" @click="onDelete">Delete</button>
        </div>
        <div class="flex gap-2">
          <button type="button" class="rounded-lg px-3 py-2 text-sm text-(--color-ink-soft)" @click="close">Cancel</button>
          <button type="submit" :disabled="submitting" class="btn-primary">
            {{ submitting ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </form>
  </dialog>
</template>
