<script setup lang="ts">
defineProps<{
  photos: Array<{
    id: string
    storageKeyThumb: string | null
    capturedAt: string | null
    locationSource: string
  }>
}>()
</script>

<template>
  <div v-if="photos.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
    <div
      v-for="photo in photos"
      :key="photo.id"
      class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)"
    >
      <img
        v-if="photo.storageKeyThumb"
        :src="`/api/files/${encodeURIComponent(photo.storageKeyThumb)}`"
        :alt="photo.capturedAt ?? 'photo'"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-xs text-(--color-ink-soft)">
        processing…
      </div>
      <span
        v-if="photo.locationSource === 'unresolved'"
        class="absolute right-1 top-1 rounded-full bg-(--color-gold) px-1.5 py-0.5 text-[10px] text-white"
        title="No location detected"
      >
        ?
      </span>
    </div>
  </div>
  <p v-else class="text-sm text-(--color-ink-soft)">No photos yet.</p>
</template>
