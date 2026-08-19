import type { InjectionKey } from 'vue'

/**
 * The shell page (authenticated or shared) provides these; every panel/leaf
 * component reads them instead of hardcoding "/api/files" or "/journeys/:id"
 * — the same component tree serves both an owner's session and an anonymous
 * share-token visitor (§13/§19), and this is the seam that makes that work
 * without threading two extra props through every intermediate component.
 */
export const FILES_BASE_KEY: InjectionKey<string> = Symbol('filesBase')
export const LINK_BASE_KEY: InjectionKey<string> = Symbol('linkBase')
export const READONLY_KEY: InjectionKey<boolean> = Symbol('readonly')

export function provideJourneyContext(opts: { filesBase: string; linkBase: string; readonly: boolean }) {
  provide(FILES_BASE_KEY, opts.filesBase)
  provide(LINK_BASE_KEY, opts.linkBase)
  provide(READONLY_KEY, opts.readonly)
}

/** Base path for photo bytes: "/api/files" (authenticated) or "/api/shared/:token/files" (shared). */
export function useFilesBase(): string {
  return inject(FILES_BASE_KEY, '/api/files')
}

/** Base path for in-app links: "/journeys/:id" (authenticated) or "/shared/:token" (shared). */
export function useLinkBase(): string {
  return inject(LINK_BASE_KEY, '/journeys')
}

export function useReadonly(): boolean {
  return inject(READONLY_KEY, false)
}
