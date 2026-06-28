import {
  addLoop,
  emptyLoopLibrary,
  type LoopLibrary,
  type NamedLoop,
  removeLoop
} from '../domain/loop-library.ts'
import type { LoopStore } from './ports.ts'

export interface LoopStoreDeps {
  readonly store: LoopStore
}

/** Load the saved library; a failing/empty store reads as no loops. */
export async function loadLoops(deps: LoopStoreDeps): Promise<LoopLibrary> {
  try {
    return await deps.store.load()
  } catch {
    return emptyLoopLibrary
  }
}

/**
 * Add a loop to the library and persist it (best-effort — a storage failure
 * still returns the updated in-memory library, so the UI stays consistent).
 */
export async function saveLoop(
  input: { readonly library: LoopLibrary; readonly loop: NamedLoop },
  deps: LoopStoreDeps
): Promise<LoopLibrary> {
  const next = addLoop(input.library, input.loop)
  await persist(next, deps.store)
  return next
}

/** Remove a loop from the library and persist it (best-effort). */
export async function deleteLoop(
  input: { readonly library: LoopLibrary; readonly id: string },
  deps: LoopStoreDeps
): Promise<LoopLibrary> {
  const next = removeLoop(input.library, input.id)
  await persist(next, deps.store)
  return next
}

async function persist(library: LoopLibrary, store: LoopStore): Promise<void> {
  try {
    await store.save(library)
  } catch {
    // Best-effort: a full/blocked storage must not break the session.
  }
}
