import {
  addLoop,
  emptyLoopLibrary,
  type LoopLibrary,
  type LoopRegion,
  type NamedLoop,
  removeLoop
} from '@app/core'
import { useState } from 'react'

export interface Loops {
  readonly library: LoopLibrary
  /** Save a fresh loop and return it (with its minted id). */
  readonly save: (name: string, region: LoopRegion) => NamedLoop
  /** Re-save an existing loop (same id), e.g. after editing its name/edges. */
  readonly update: (loop: NamedLoop) => void
  readonly remove: (id: string) => void
  /** Replace the whole library with a persisted one (opening a project). */
  readonly restore: (library: LoopLibrary) => void
  /** Drop every loop — a fresh track starts with an empty library. */
  readonly clear: () => void
}

/**
 * Smart hook for the saved-loop library. Loops are session state, scoped to
 * the loaded track: they persist only through the project manifest (saved on
 * « Enregistrer », restored on open) and a new import starts empty.
 */
export function useLoops(): Loops {
  const [library, setLibrary] = useState<LoopLibrary>(emptyLoopLibrary)

  function save(name: string, region: LoopRegion): NamedLoop {
    const loop: NamedLoop = { id: crypto.randomUUID(), name, region }
    update(loop)
    return loop
  }

  function update(loop: NamedLoop): void {
    // addLoop replaces by id, so re-saving edits in place.
    setLibrary((current) => addLoop(current, loop))
  }

  function remove(id: string): void {
    setLibrary((current) => removeLoop(current, id))
  }

  function restore(next: LoopLibrary): void {
    setLibrary(next)
  }

  function clear(): void {
    restore(emptyLoopLibrary)
  }

  return { library, save, update, remove, restore, clear }
}
