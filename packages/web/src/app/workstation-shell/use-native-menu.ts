import { useEffect } from 'react'
import { isTauriShell } from '../../auth/tauri-env.ts'
import { useLatest } from '../../lib/use-latest.ts'

/** The shell actions the native menu bar drives (`menu.rs` item ids). */
export interface NativeMenuActions {
  /** Fichier → Importer… (⌘O) */
  readonly import: () => void
  /** Fichier → Enregistrer (⌘S) */
  readonly save: () => void
  /** Aide → Raccourcis clavier */
  readonly shortcuts: () => void
}

/**
 * Route the desktop shell's native menu bar onto the shell's existing
 * handlers: `menu.rs` emits a `menu` event whose payload is the item id.
 * Outside the Tauri shell (browser, jsdom) this is inert. Handlers ride a
 * ref so the one listener never re-subscribes on render.
 */
export function useNativeMenu(actions: NativeMenuActions): void {
  const latest = useLatest(actions)
  useEffect(() => {
    if (!isTauriShell()) {
      return
    }
    let disposed = false
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('menu', (event) => {
        const action = latest.current[event.payload as keyof NativeMenuActions]
        action?.()
      }).then((stop) => {
        // The subscription resolves after an unmount: stop it right away.
        if (disposed) {
          stop()
        } else {
          unlisten = stop
        }
      })
    )
    return () => {
      disposed = true
      unlisten?.()
    }
    // `latest` is a stable ref (useLatest) — subscribe exactly once, the ref
    // carries the fresh handlers.
  }, [])
}
