<script setup lang="ts">
type PickerMode = 'album' | 'dates'
type Album = { id: string; albumName: string; assetCount: number }
type Asset = { id: string; filename: string; takenAt: string; thumbnailUrl: string }
type ImportResult = { filename: string; status: string; reason?: string }

const props = defineProps<{ journeyId: string; journey: { startDate: string; endDate: string } }>()
const emit = defineEmits<{ uploaded: [] }>()

const connection = ref<'loading' | 'connected' | 'disconnected'>('loading')
const mode = ref<PickerMode>('album')

const albums = ref<Album[]>([])
const albumsLoading = ref(false)
const selectedAlbumId = ref<string | null>(null)

const fromDate = ref(props.journey.startDate)
const toDate = ref(props.journey.endDate)

const assets = ref<Asset[]>([])
const assetsLoading = ref(false)
const assetsError = ref<string | null>(null)
const selectedIds = ref<Set<string>>(new Set())

const importing = ref(false)
const importError = ref<string | null>(null)
const lastResults = ref<ImportResult[]>([])

onMounted(async () => {
  try {
    const status = await $fetch<{ connected: boolean }>('/api/account/immich')
    connection.value = status.connected ? 'connected' : 'disconnected'
    if (status.connected) loadAlbums()
  } catch {
    connection.value = 'disconnected'
  }
})

async function loadAlbums() {
  albumsLoading.value = true
  try {
    albums.value = await $fetch<Album[]>(`/api/journeys/${props.journeyId}/immich/albums`)
  } finally {
    albumsLoading.value = false
  }
}

async function loadAssets() {
  assets.value = []
  selectedIds.value = new Set()
  assetsError.value = null

  const query =
    mode.value === 'album'
      ? selectedAlbumId.value
        ? { albumId: selectedAlbumId.value }
        : null
      : fromDate.value && toDate.value
        ? { from: fromDate.value, to: toDate.value }
        : null
  if (!query) return

  assetsLoading.value = true
  try {
    assets.value = await $fetch<Asset[]>(`/api/journeys/${props.journeyId}/immich/assets`, { query })
  } catch (err: any) {
    assetsError.value = err?.data?.statusMessage ?? 'Could not load photos from Immich.'
  } finally {
    assetsLoading.value = false
  }
}

function selectAlbum(id: string) {
  selectedAlbumId.value = id
  loadAssets()
}

function toggleAsset(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

async function importSelected() {
  if (!selectedIds.value.size) return
  importing.value = true
  importError.value = null
  lastResults.value = []
  try {
    const selected = assets.value.filter((a) => selectedIds.value.has(a.id))
    const res = await $fetch<{ files: ImportResult[] }>(`/api/journeys/${props.journeyId}/immich/import`, {
      method: 'POST',
      body: { assets: selected.map((a) => ({ assetId: a.id, filename: a.filename })) }
    })
    lastResults.value = res.files
    selectedIds.value = new Set()
    emit('uploaded')
  } catch (err: any) {
    importError.value = err?.data?.statusMessage ?? 'Import failed.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="connection === 'loading'" class="text-sm text-(--color-ink-soft)">Checking Immich connection…</p>

    <p v-else-if="connection === 'disconnected'" class="text-sm text-(--color-ink-soft)">
      Connect your Immich server first in
      <NuxtLink to="/settings" class="text-(--color-teal) underline">Settings</NuxtLink>.
    </p>

    <template v-else>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-chip flex-1"
          :class="{ '!bg-(--color-ink) !text-(--color-cream)': mode === 'album' }"
          @click="mode = 'album'"
        >
          Album
        </button>
        <button
          type="button"
          class="btn-chip flex-1"
          :class="{ '!bg-(--color-ink) !text-(--color-cream)': mode === 'dates' }"
          @click="mode = 'dates'; loadAssets()"
        >
          Date range
        </button>
      </div>

      <div v-if="mode === 'album'" class="flex flex-col gap-2">
        <p v-if="albumsLoading" class="text-xs text-(--color-ink-soft)">Loading albums…</p>
        <p v-else-if="!albums.length" class="text-xs text-(--color-ink-soft)">No albums found on your Immich server.</p>
        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="album in albums"
            :key="album.id"
            type="button"
            class="btn-chip"
            :class="{ '!bg-(--color-ink) !text-(--color-cream)': selectedAlbumId === album.id }"
            @click="selectAlbum(album.id)"
          >
            {{ album.albumName }} ({{ album.assetCount }})
          </button>
        </div>
      </div>

      <div v-else class="flex gap-2">
        <label class="flex flex-1 flex-col gap-1 text-sm">
          From
          <input v-model="fromDate" type="date" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" @change="loadAssets" />
        </label>
        <label class="flex flex-1 flex-col gap-1 text-sm">
          To
          <input v-model="toDate" type="date" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" @change="loadAssets" />
        </label>
      </div>

      <p v-if="assetsLoading" class="text-xs text-(--color-ink-soft)">Loading photos…</p>
      <p v-else-if="assetsError" class="text-sm text-(--color-brick)">{{ assetsError }}</p>

      <div v-if="assets.length" class="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <button
          v-for="asset in assets"
          :key="asset.id"
          type="button"
          class="relative aspect-square overflow-hidden rounded-lg bg-(--color-paper-raised)"
          @click="toggleAsset(asset.id)"
        >
          <img :src="asset.thumbnailUrl" class="h-full w-full object-cover" :class="{ 'opacity-60': selectedIds.has(asset.id) }" loading="lazy" alt="" />
          <div
            class="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
            :class="selectedIds.has(asset.id) ? 'bg-(--color-teal) text-(--color-cream)' : 'bg-(--color-canvas)/50 text-(--color-cream)/70'"
          >
            <svg v-if="selectedIds.has(asset.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
        </button>
      </div>

      <p v-if="importError" class="text-sm text-(--color-brick)">{{ importError }}</p>
      <ul v-if="lastResults.length" class="animate-fade-up space-y-1 text-left font-mono text-xs text-(--color-ink-soft)">
        <li v-for="r in lastResults" :key="r.filename">
          {{ r.filename }} —
          <span :class="{ 'text-(--color-brick)': r.status === 'rejected' }">{{ r.status }}</span>
          <span v-if="r.reason"> ({{ r.reason }})</span>
        </li>
      </ul>

      <button type="button" class="btn-primary self-end" :disabled="!selectedIds.size || importing" @click="importSelected">
        {{ importing ? 'Importing…' : `Import ${selectedIds.size || ''} photo${selectedIds.size === 1 ? '' : 's'}`.trim() }}
      </button>
    </template>
  </div>
</template>
