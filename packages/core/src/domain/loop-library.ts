import type { LoopRegion } from './loop-region.ts'

/** A saved, named A/B loop. */
export interface NamedLoop {
  readonly id: string
  readonly name: string
  readonly region: LoopRegion
}

/** An immutable, start-time-ordered collection of saved loops. */
export type LoopLibrary = ReadonlyArray<NamedLoop>

export const emptyLoopLibrary: LoopLibrary = []

/**
 * Insert a loop, keeping the library sorted by region start. Re-adding the same
 * `id` replaces it (so an edited loop stays unique). Pure — a new library out.
 */
export function addLoop(library: LoopLibrary, loop: NamedLoop): LoopLibrary {
  const without = library.filter((existing) => existing.id !== loop.id)
  const index = without.findIndex(
    (existing) => existing.region.startSeconds > loop.region.startSeconds
  )
  if (index === -1) {
    return [...without, loop]
  }
  return [...without.slice(0, index), loop, ...without.slice(index)]
}

/** Drop the loop with `id`; a missing id leaves the library unchanged. */
export function removeLoop(library: LoopLibrary, id: string): LoopLibrary {
  return library.filter((loop) => loop.id !== id)
}
