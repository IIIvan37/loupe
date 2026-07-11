import { useSyncExternalStore } from 'react'

/**
 * A value that changes OUTSIDE React state — the playhead position streamed by
 * the audio engine at animation-frame rate. Keeping it out of any reducer means
 * a frame tick re-renders nothing by itself; consumers subscribe to the slice
 * they need through {@link useExternalValue}.
 */
export interface ExternalValue<T> {
  readonly get: () => T
  /** Notified after each actual change (identical sets are absorbed). */
  readonly subscribe: (listener: () => void) => () => void
}

export interface MutableExternalValue<T> extends ExternalValue<T> {
  readonly set: (next: T) => void
}

export function createExternalValue<T>(initial: T): MutableExternalValue<T> {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (next) => {
      if (Object.is(next, current)) {
        return
      }
      current = next
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

/**
 * Subscribe a component to a DERIVED view of an external value: the component
 * re-renders only when `select`'s result changes (`Object.is`), so a 60 Hz
 * playhead costs a timecode exactly one render per second and a lead-sheet one
 * per measure. `select` must return a primitive (or stable reference) — a
 * fresh object every call would re-render every frame.
 */
export function useExternalValue<T, S>(
  value: ExternalValue<T>,
  select: (current: T) => S
): S {
  return useSyncExternalStore(value.subscribe, () => select(value.get()))
}
