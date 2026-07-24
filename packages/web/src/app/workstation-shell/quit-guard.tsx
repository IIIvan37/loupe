import { useState } from 'react'
import { isTauriShell } from '../../auth/tauri-env.ts'
import { ConfirmQuitDialog } from './confirm-quit-dialog.tsx'
import { confirmClose, useCloseGuard } from './use-close-guard.ts'
import { useUnloadGuard } from './use-unload-guard.ts'

/**
 * « Leaving must never silently drop unsaved work », both exits in one
 * self-contained piece: the browser path keeps the native beforeunload
 * prompt; the desktop path (AP.2) answers the shell's held-open close —
 * a clean session closes straight away, a dirty one gets the « Quitter
 * sans enregistrer ? » dialog whose only « Quitter » lets it through.
 */
export function QuitGuard({ unsavedWork }: { readonly unsavedWork: boolean }) {
  const [asked, setAsked] = useState(false)
  // Reload/tab-close: the beforeunload prompt is the BROWSER's only guard.
  // Under the shell it stays off — the native path owns the question, and a
  // platform that fired beforeunload during destroy would double-prompt.
  useUnloadGuard(unsavedWork && !isTauriShell())
  useCloseGuard(unsavedWork, () => setAsked(true))
  return (
    <ConfirmQuitDialog
      open={asked}
      onConfirm={confirmClose}
      onCancel={() => setAsked(false)}
    />
  )
}
