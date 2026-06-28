import type { LoopLibrary, LoopStore } from '@app/core'

const STORAGE_KEY = 'loupe.loops'

/**
 * Driven adapter for the `LoopStore` port, backed by `localStorage`. Reads and
 * writes are guarded — a blocked/full/corrupt store reads as no loops rather than
 * throwing (the use-cases also treat persistence as best-effort).
 */
export function createLocalStorageLoopStore(): LoopStore {
  return {
    async load(): Promise<LoopLibrary> {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          return []
        }
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as LoopLibrary) : []
      } catch {
        // Corrupt JSON or blocked storage → no loops.
        return []
      }
    },

    async save(library: LoopLibrary): Promise<void> {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
      } catch {
        // Full or blocked storage must not break the session.
      }
    }
  }
}
