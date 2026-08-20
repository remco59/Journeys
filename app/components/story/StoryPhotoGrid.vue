<script setup lang="ts">
type Photo = { id: string; storageKeyThumb: string | null; storageKeyPreview: string | null; capturedAt: string | null }

const props = defineProps<{ sectionId: string; photos: Photo[] }>()

const MAX_SHOWN = 3
const linkBase = useLinkBase()
const filesBase = useFilesBase()

const shown = computed(() => props.photos.slice(0, MAX_SHOWN))
const overflowCount = computed(() => Math.max(0, props.photos.length - MAX_SHOWN))

function url(key: string | null) {
  return key ? `${filesBase}/${encodeURIComponent(key)}` : null
}
function photoLink(photoId: string) {
  return `${linkBase}/gallery?section=${props.sectionId}&photo=${photoId}`
}
</script>

<template>
  <div v-if="shown.length === 1" class="mt-4">
    <NuxtLink :to="photoLink(shown[0]!.id)" class="block overflow-hidden rounded-2xl bg-(--color-paper-raised)">
      <img :src="url(shown[0]!.storageKeyPreview ?? shown[0]!.storageKeyThumb)!" class="h-auto w-full" loading="lazy" :alt="shown[0]!.capturedAt ?? ''" />
    </NuxtLink>
  </div>

  <div v-else-if="shown.length === 2" class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
    <NuxtLink v-for="p in shown" :key="p.id" :to="photoLink(p.id)" class="block aspect-[4/3] overflow-hidden rounded-2xl bg-(--color-paper-raised)">
      <img :src="url(p.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" :alt="p.capturedAt ?? ''" />
    </NuxtLink>
  </div>

  <div v-else-if="shown.length >= 3" class="mt-4 grid grid-cols-2 gap-2">
    <NuxtLink :to="photoLink(shown[0]!.id)" class="col-span-2 block aspect-[16/10] overflow-hidden rounded-2xl bg-(--color-paper-raised)">
      <img :src="url(shown[0]!.storageKeyPreview ?? shown[0]!.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" :alt="shown[0]!.capturedAt ?? ''" />
    </NuxtLink>
    <NuxtLink :to="photoLink(shown[1]!.id)" class="block aspect-square overflow-hidden rounded-2xl bg-(--color-paper-raised)">
      <img :src="url(shown[1]!.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" :alt="shown[1]!.capturedAt ?? ''" />
    </NuxtLink>
    <NuxtLink :to="photoLink(shown[2]!.id)" class="relative block aspect-square overflow-hidden rounded-2xl bg-(--color-paper-raised)">
      <img :src="url(shown[2]!.storageKeyThumb)!" class="h-full w-full object-cover" loading="lazy" :alt="shown[2]!.capturedAt ?? ''" />
      <span
        v-if="overflowCount > 0"
        class="absolute inset-0 flex items-center justify-center bg-(--color-canvas)/55 font-(family-name:--font-display) text-2xl font-medium text-(--color-cream)"
      >
        +{{ overflowCount }}
      </span>
    </NuxtLink>
  </div>
</template>
