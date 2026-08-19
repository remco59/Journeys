<script setup lang="ts">
const props = defineProps<{
  journeyId: string
  section?: {
    id: string
    title: string
    placeName: string | null
    description: string | null
    arrivalAt?: string | null
    departureAt?: string | null
    lat?: number | null
    lon?: number | null
  } | null
}>()
const emit = defineEmits<{ saved: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const title = ref('')
const placeName = ref('')
const description = ref('')
const arrivalLocal = ref('')
const departureLocal = ref('')
const point = ref<{ lat: number; lon: number } | null>(null)
const error = ref<string | null>(null)
const submitting = ref(false)

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function open() {
  error.value = null
  title.value = props.section?.title ?? ''
  placeName.value = props.section?.placeName ?? ''
  description.value = props.section?.description ?? ''
  arrivalLocal.value = toDatetimeLocal(props.section?.arrivalAt)
  departureLocal.value = toDatetimeLocal(props.section?.departureAt)
  point.value =
    props.section?.lat != null && props.section?.lon != null ? { lat: props.section.lat, lon: props.section.lon } : null
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
    const body: Record<string, unknown> = {
      title: title.value,
      placeName: placeName.value || undefined,
      description: description.value || undefined
    }
    if (arrivalLocal.value) body.arrivalAt = new Date(arrivalLocal.value).toISOString()
    if (departureLocal.value) body.departureAt = new Date(departureLocal.value).toISOString()
    if (point.value) {
      body.lat = point.value.lat
      body.lon = point.value.lon
    }
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

      <div class="flex gap-3">
        <label class="flex flex-1 flex-col gap-1 text-sm">
          Arrival
          <input v-model="arrivalLocal" type="datetime-local" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
        <label class="flex flex-1 flex-col gap-1 text-sm">
          Departure
          <input v-model="departureLocal" type="datetime-local" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        Location
        <PhotoMapPointPicker v-model="point" />
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
