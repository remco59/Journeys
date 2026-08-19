<script setup lang="ts">
defineProps<{
  photos: Array<{ id: string; storageKeyThumb: string | null; capturedAt: string | null; locationSource: string }>
}>()
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10">
    <p class="mb-4 text-sm text-(--color-ink-soft)">
      All photos, chronologically. Grouping by section and a lightbox land in Phase 7.
    </p>
    <PhotoPhotoGrid :photos="photos" />
  </div>
</template>
