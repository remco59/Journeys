<script setup lang="ts">
defineProps<{
  photos: Array<{ id: string; storageKeyThumb: string | null; capturedAt: string | null }>
}>()

const emit = defineEmits<{ select: [photoId: string] }>()
const filesBase = useFilesBase()
</script>

<template>
  <div class="columns-2 gap-2 sm:columns-3 md:columns-4">
    <button
      v-for="photo in photos"
      :key="photo.id"
      class="mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg bg-(--color-paper-raised)"
      @click="emit('select', photo.id)"
    >
      <img
        v-if="photo.storageKeyThumb"
        :src="`${filesBase}/${encodeURIComponent(photo.storageKeyThumb)}`"
        class="w-full"
        loading="lazy"
        :alt="photo.capturedAt ?? 'photo'"
      />
    </button>
  </div>
</template>
