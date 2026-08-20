<script setup lang="ts">
type Photo = { id: string; storageKeyThumb: string | null }

const props = defineProps<{ journeyId: string; photos: Photo[]; selectedId: string | null }>()
const emit = defineEmits<{ 'update:selectedId': [id: string | null]; uploaded: [] }>()

const filesBase = useFilesBase()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)

const selectedPhoto = computed(() => props.photos.find((p) => p.id === props.selectedId) ?? null)

function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}

function choose(photoId: string) {
  emit('update:selectedId', props.selectedId === photoId ? null : photoId)
}

async function onFilesSelected(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return

  error.value = null
  uploading.value = true

  const form = new FormData()
  form.append('file', files[0]!, files[0]!.name)

  try {
    const res = await $fetch<{ files: Array<{ filename: string; status: string; photoId?: string; reason?: string }> }>(
      `/api/journeys/${props.journeyId}/photos`,
      { method: 'POST', body: form }
    )
    emit('uploaded')
    const created = res.files.find((f) => f.status === 'queued' && f.photoId)
    if (created?.photoId) emit('update:selectedId', created.photoId)
    else if (res.files[0]?.status === 'rejected') error.value = res.files[0].reason ?? 'Upload failed.'
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Upload failed.'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-3">
      <div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-(--color-paper-raised)">
        <img v-if="url(selectedPhoto?.storageKeyThumb ?? null)" :src="url(selectedPhoto?.storageKeyThumb ?? null)!" class="h-full w-full object-cover" alt="" />
      </div>
      <div class="min-w-0 flex-1 text-xs text-(--color-ink-soft)">
        {{ selectedPhoto ? 'Selected as cover' : 'No cover photo set' }}
      </div>
      <button v-if="selectedId" type="button" class="shrink-0 text-xs text-(--color-ink-soft) hover:text-(--color-ink)" @click="emit('update:selectedId', null)">
        Clear
      </button>
    </div>

    <div v-if="photos.length" class="grid grid-cols-5 gap-1.5">
      <button
        v-for="p in photos"
        :key="p.id"
        type="button"
        class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)"
        :class="p.id === selectedId ? 'ring-2 ring-(--color-activity)' : ''"
        @click="choose(p.id)"
      >
        <img v-if="url(p.storageKeyThumb)" :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" alt="" />
      </button>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilesSelected" />
    <button type="button" class="btn-chip self-start" :disabled="uploading" @click="fileInput?.click()">
      {{ uploading ? 'Uploading…' : 'Upload new photo' }}
    </button>
    <p v-if="error" class="text-xs text-(--color-brick)">{{ error }}</p>
  </div>
</template>
