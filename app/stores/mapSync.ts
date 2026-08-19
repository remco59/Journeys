import { defineStore } from 'pinia'

/**
 * The only real coupling between the Story and Map views (§13/§14):
 * selecting a section in one place updates this store, and the other view
 * reacts to it — no direct component-to-component calls.
 */
export const useMapSyncStore = defineStore('mapSync', {
  state: () => ({
    selectedSectionId: null as string | null
  }),
  actions: {
    select(sectionId: string | null) {
      this.selectedSectionId = sectionId
    }
  }
})
