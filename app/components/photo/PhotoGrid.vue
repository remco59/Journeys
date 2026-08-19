<script setup lang="ts">
withDefaults(
  defineProps<{
    photos: Array<{
      id: string
      storageKeyThumb: string | null
      capturedAt: string | null
      locationSource: string
    }>
    otherSections?: Array<{ id: string; title: string }>
  }>(),
  { otherSections: () => [] }
)

const emit = defineEmits<{ move: [photoId: string, sectionId: string] }>()

function onMove(photoId: string, event: Event) {
  const sectionId = (event.target as HTMLSelectElement).value
  if (sectionId) emit('move', photoId, sectionId)
}
</script>

<template>
  <div v-if="photos.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
    <div
      v-for="photo in photos"
      :key="photo.id"
      class="group relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)"
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
      <select
        v-if="otherSections.length"
        class="absolute inset-x-0 bottom-0 w-full truncate border-0 bg-black/55 px-1 py-0.5 text-[10px] text-white opacity-0 focus:opacity-100 group-hover:opacity-100"
        title="Move to another section"
        @change="onMove(photo.id, $event)"
      >
        <option value="">Move to…</option>
        <option v-for="s in otherSections" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
    </div>
  </div>
  <p v-else class="text-sm text-(--color-ink-soft)">No photos yet.</p>
</template>
