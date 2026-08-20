<script setup lang="ts">
const ITEMS = [
  { label: 'Confirmed', class: 'border-t-2 border-solid border-(--color-teal)' },
  { label: 'Likely', class: 'border-t-2 border-dashed border-(--color-gold)' },
  { label: 'Route inferred', class: 'border-t-2 border-dotted border-(--color-stone)' }
]
</script>

<template>
  <div class="dark-pill flex-wrap gap-x-4 gap-y-1.5 !px-4 !py-2.5 text-[11px]">
    <span v-for="item in ITEMS" :key="item.label" class="flex items-center gap-1.5">
      <span class="inline-block w-4" :class="item.class" />
      {{ item.label }}
    </span>
  </div>
</template>
