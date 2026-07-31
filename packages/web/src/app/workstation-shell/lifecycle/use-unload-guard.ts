import { useEffect } from 'react'

/**
 * While `enabled`, ask the browser to confirm leaving the page — the native
 * beforeunload prompt is the only guard a reload or tab close can get, since
 * the app never sees those gestures.
 */
/** The guard as a mountable piece — keeps the hook out of the shell's own
 * budget (ADR 0010's busiest-component ratchet), like QuitGuard did. */
export function UnloadGuard({
  unsavedWork
}: {
  readonly unsavedWork: boolean
}): null {
  useUnloadGuard(unsavedWork)
  return null
}

export function useUnloadGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const guard = (event: BeforeUnloadEvent): void => {
      // The one supported trigger: `returnValue` is deprecated and was only
      // needed by Chrome/Edge < 119 (MDN, BeforeUnloadEvent.returnValue).
      event.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [enabled])
}
