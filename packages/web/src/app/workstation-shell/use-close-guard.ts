import { useEffect } from 'react'
import { isTauriShell } from '../../auth/tauri-env.ts'
import { useLatest } from '../../lib/use-latest.ts'

/** The webview's verdict: actually close the window (opens the Rust latch). */
export function confirmClose(): void {
  void import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('confirm_close')
  )
}

/**
 * AP.2 — the native unsaved-work guard, webview side. The Rust shell holds
 * every exit path open (red button AND Cmd+Q) and emits `close-requested`;
 * the dirty state lives HERE, so this decides: a clean session closes
 * immediately, a dirty one raises `onConfirmNeeded` (the quit dialog) and
 * only its « Quitter » calls `confirmClose`. Outside the Tauri shell this is
 * inert — the browser keeps its `beforeunload` guard.
 */
export function useCloseGuard(
  unsavedWork: boolean,
  onConfirmNeeded: () => void
): void {
  const latest = useLatest({ unsavedWork, onConfirmNeeded })
  useEffect(() => {
    if (!isTauriShell()) {
      return
    }
    let disposed = false
    let unlisten: (() => void) | undefined
    const install = async (): Promise<void> => {
      const { listen } = await import('@tauri-apps/api/event')
      const stop = await listen('close-requested', () => {
        // Read at CLOSE time — the subscription is mounted once, the ref
        // carries the fresh dirty flag.
        if (latest.current.unsavedWork) {
          latest.current.onConfirmNeeded()
        } else {
          confirmClose()
        }
      })
      // The subscription resolves after an unmount: stop it right away.
      if (disposed) {
        stop()
        return
      }
      unlisten = stop
      // Only NOW may the shell hold exits open: arming before the listener
      // exists would make the app unclosable on a slow mount.
      const { invoke } = await import('@tauri-apps/api/core')
      void invoke('arm_close_guard')
    }
    void install()
    return () => {
      disposed = true
      unlisten?.()
    }
    // `latest` is a stable ref (useLatest) — subscribe exactly once.
  }, [])
}
