<script setup lang="ts">
// Picks up where PhotoUploader's inline progress leaves off once its dialog
// closes or the page navigates away — see useUploadTracker for why the
// upload itself keeps running regardless.
const tracker = useUploadTracker()

const show = ref(false)
const finished = ref<'success' | 'error' | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const percent = computed(() =>
  tracker.value.total ? Math.round((tracker.value.current / tracker.value.total) * 100) : 0
)

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function dismiss() {
  clearHideTimer()
  show.value = false
  finished.value = null
  tracker.value.hidden = false
}

watch(
  () => [tracker.value.active, tracker.value.hidden, tracker.value.error] as const,
  ([active, hidden]) => {
    clearHideTimer()
    if (active && hidden) {
      show.value = true
      finished.value = null
      return
    }
    if (show.value && !active) {
      finished.value = tracker.value.error ? 'error' : 'success'
      hideTimer = setTimeout(dismiss, 4000)
    }
  },
  { immediate: true }
)
</script>

<template>
  <Transition name="upload-toast">
    <div
      v-if="show"
      class="dark-pill fixed inset-x-3 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 !px-4 !py-3"
      style="bottom: calc(5.75rem + env(safe-area-inset-bottom, 0px))"
    >
      <template v-if="finished === 'success'">
        <span>Photos uploaded</span>
        <NuxtLink v-if="tracker.journeyId" :to="`/journeys/${tracker.journeyId}`" class="text-(--color-gold) hover:underline">
          View
        </NuxtLink>
      </template>
      <template v-else-if="finished === 'error'">
        <span class="text-(--color-brick)">{{ tracker.error ?? 'Upload failed' }}</span>
      </template>
      <template v-else>
        <span class="animate-pulse-soft">Uploading photo {{ tracker.current }} of {{ tracker.total }} ({{ percent }}%)</span>
      </template>
      <button type="button" class="opacity-70 transition hover:opacity-100" aria-label="Dismiss" @click="dismiss">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.upload-toast-enter-active,
.upload-toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.upload-toast-enter-from,
.upload-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
