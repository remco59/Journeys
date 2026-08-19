<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const { data: journey, refresh } = await useFetch(`/api/journeys/${id}`)
if (!journey.value) {
  throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
}

const editing = ref(false)
const title = ref(journey.value.title)
const description = ref(journey.value.description ?? '')
const startDate = ref(journey.value.startDate)
const endDate = ref(journey.value.endDate)
const error = ref<string | null>(null)

async function saveEdits() {
  error.value = null
  try {
    await $fetch(`/api/journeys/${id}`, {
      method: 'PATCH',
      body: { title: title.value, description: description.value, startDate: startDate.value, endDate: endDate.value }
    })
    editing.value = false
    await refresh()
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not save changes.'
  }
}

async function onDelete() {
  if (!confirm(`Delete "${journey.value?.title}"? This cannot be undone.`)) return
  await $fetch(`/api/journeys/${id}`, { method: 'DELETE' })
  await navigateTo('/')
}

const durationDays = computed(() => {
  if (!journey.value) return 0
  const start = new Date(journey.value.startDate)
  const end = new Date(journey.value.endDate)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
})
</script>

<template>
  <div v-if="journey" class="min-h-screen bg-(--color-paper) pb-24">
    <header class="border-b border-(--color-line) bg-(--color-paper-raised)">
      <div class="mx-auto max-w-4xl px-6 py-6">
        <NuxtLink to="/" class="text-sm text-(--color-ink-soft) hover:text-(--color-ink)">← Journeys</NuxtLink>

        <div v-if="!editing" class="mt-2">
          <h1 class="font-(family-name:--font-display) text-3xl font-medium">{{ journey.title }}</h1>
          <p class="mt-1 text-(--color-ink-soft)">
            {{ journey.startDate }} – {{ journey.endDate }} · {{ durationDays }} day{{ durationDays === 1 ? '' : 's' }}
          </p>
          <p v-if="journey.description" class="mt-3 max-w-2xl text-(--color-ink)">{{ journey.description }}</p>
          <div class="mt-4 flex gap-3 text-sm">
            <button class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="editing = true">Edit</button>
            <button class="text-red-600 hover:text-red-700" @click="onDelete">Delete</button>
          </div>
        </div>

        <form v-else class="mt-3 flex max-w-md flex-col gap-3" @submit.prevent="saveEdits">
          <input v-model="title" required class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
          <textarea v-model="description" rows="2" class="rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
          <div class="flex gap-3">
            <input v-model="startDate" type="date" class="flex-1 rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
            <input v-model="endDate" type="date" class="flex-1 rounded-lg border border-(--color-line) bg-transparent px-3 py-2" />
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <div class="flex gap-2">
            <button type="submit" class="rounded-lg bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper)">Save</button>
            <button type="button" class="rounded-lg px-4 py-2 text-sm text-(--color-ink-soft)" @click="editing = false">Cancel</button>
          </div>
        </form>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-10 text-(--color-ink-soft)">
      <p>Trip, Map, Story and Gallery views land in later phases.</p>
    </main>
  </div>
</template>
