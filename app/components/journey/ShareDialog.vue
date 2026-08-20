<script setup lang="ts">
const props = defineProps<{ journeyId: string }>()

type Share = { id: string; token: string; createdAt: string; revokedAt: string | null }

const dialog = ref<HTMLDialogElement | null>(null)
const shares = ref<Share[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    shares.value = await $fetch<Share[]>(`/api/journeys/${props.journeyId}/shares`)
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Could not load share links.'
  } finally {
    loading.value = false
  }
}

function open() {
  dialog.value?.showModal()
  load()
}
function close() {
  dialog.value?.close()
}
defineExpose({ open })

function shareUrl(token: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/shared/${token}`
}

async function createLink() {
  await $fetch(`/api/journeys/${props.journeyId}/shares`, { method: 'POST' })
  await load()
}

async function revoke(shareId: string) {
  if (!confirm('Revoke this link? Anyone using it will immediately lose access.')) return
  await $fetch(`/api/shares/${shareId}`, { method: 'DELETE' })
  await load()
}

const copiedId = ref<string | null>(null)
async function copy(token: string, id: string) {
  await navigator.clipboard.writeText(shareUrl(token))
  copiedId.value = id
  setTimeout(() => (copiedId.value = null), 1500)
}
</script>

<template>
  <dialog ref="dialog" class="sheet">
    <div class="sheet-handle" />
    <div class="flex flex-col gap-3 p-6 pt-2">
      <div class="flex items-center justify-between">
        <h2 class="font-(family-name:--font-display) text-xl font-medium">Share this journey</h2>
        <button class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="close">✕</button>
      </div>
      <p class="text-sm text-(--color-ink-soft)">
        Anyone with a link below can view Trip, Map, Story, and Gallery — read-only, no account needed.
      </p>

      <button class="btn-primary self-start" @click="createLink">New share link</button>

      <p v-if="error" class="text-sm text-(--color-brick)">{{ error }}</p>
      <p v-if="loading" class="text-sm text-(--color-ink-soft)">Loading…</p>

      <ul v-if="shares.length" class="mt-2 flex flex-col gap-2">
        <li
          v-for="share in shares"
          :key="share.id"
          class="flex items-center justify-between gap-2 rounded-xl bg-(--color-paper-raised) px-3 py-2 font-mono text-xs"
          :class="{ 'opacity-50': share.revokedAt }"
        >
          <span class="truncate">{{ shareUrl(share.token) }}</span>
          <span class="flex shrink-0 gap-2 font-sans text-sm">
            <span v-if="share.revokedAt" class="text-(--color-ink-soft)">Revoked</span>
            <template v-else>
              <button class="text-(--color-ink-soft) hover:text-(--color-ink)" @click="copy(share.token, share.id)">
                {{ copiedId === share.id ? 'Copied!' : 'Copy' }}
              </button>
              <button class="text-(--color-brick) hover:opacity-75" @click="revoke(share.id)">Revoke</button>
            </template>
          </span>
        </li>
      </ul>
      <p v-else-if="!loading" class="text-sm text-(--color-ink-soft)">No share links yet.</p>
    </div>
  </dialog>
</template>
