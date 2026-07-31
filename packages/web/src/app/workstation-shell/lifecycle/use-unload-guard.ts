import { useEffect } from 'react'

/**
 * While `enabled`, ask the browser to confirm leaving the page — the native
 * beforeunload prompt is the only guard a reload or tab close can get, since
 * the app never sees those gestures.
 */
export function useUnloadGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      // Some engines only surface the native prompt when returnValue is set.
      event.returnValue = true
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [enabled])
}
