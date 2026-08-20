<script setup lang="ts">
type Photo = { id: string; storageKeyThumb: string | null }

const props = defineProps<{ coverPhotoId: string | null; photos: Photo[] }>()
const emit = defineEmits<{ changed: [] }>()

const filesBase = useFilesBase()
const dialog = ref<HTMLDialogElement | null>(null)
const submitting = ref<string | null>(null)

const coverPhoto = computed(() => props.photos.find((p) => p.id === props.coverPhotoId) ?? null)

function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}

function open() {
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}

async function choose(photoId: string) {
  submitting.value = photoId
  try {
    await $fetch(`/api/photos/${photoId}/set-cover`, { method: 'POST' })
    emit('changed')
    close()
  } finally {
    submitting.value = null
  }
}
</script>

<template>
  <div class="flex items-center gap-4 rounded-2xl bg-(--color-paper-raised) p-3">
    <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-(--color-paper-raised)">
      <img v-if="url(coverPhoto?.storageKeyThumb ?? null)" :src="url(coverPhoto?.storageKeyThumb ?? null)!" class="h-full w-full object-cover" alt="Trip cover" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-(family-name:--font-display) text-base font-medium">Trip cover</p>
      <p class="mt-0.5 text-xs text-(--color-ink-soft)">Shown on the trip overview &amp; viewer</p>
    </div>
    <button class="btn-chip shrink-0" @click="open">Change</button>
  </div>

  <dialog ref="dialog" class="sheet">
    <div class="sheet-handle" />
    <div class="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-6 pt-2">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Choose a cover photo</h2>
        <button class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="close">✕</button>
      </div>
      <div v-if="photos.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          v-for="p in photos"
          :key="p.id"
          class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised) disabled:opacity-50"
          :disabled="submitting === p.id"
          @click="choose(p.id)"
        >
          <img v-if="url(p.storageKeyThumb)" :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" alt="" />
          <span v-if="p.id === coverPhotoId" class="absolute right-1 top-1 text-(--color-gold)">★</span>
        </button>
      </div>
      <p v-else class="text-sm text-(--color-ink-soft)">Upload some photos first.</p>
    </div>
  </dialog>
</template>
