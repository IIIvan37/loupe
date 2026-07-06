import { Toast } from '@base-ui-components/react/toast'
import { useCallback, useMemo } from 'react'

/** A Base UI toast manager, created per shell instance — never a global singleton. */
export type Toaster = ReturnType<typeof Toast.createToastManager>

export interface UseToaster {
  /** The manager to hand to `<ToastRegion>`, which hosts the viewport. */
  readonly toaster: Toaster
  /** Raise a transient success confirmation (auto-dismissed by the provider). */
  readonly notifySuccess: (message: string) => void
}

/**
 * Owns a per-instance toast manager. `createToastManager` lets us `add` from
 * OUTSIDE the provider tree (success handlers, not components), so the shell can
 * raise a confirmation from any callback without threading React context — while
 * staying isolated per render, so tests never leak toasts into one another.
 */
export function useToaster(): UseToaster {
  const toaster = useMemo(() => Toast.createToastManager(), [])
  const notifySuccess = useCallback(
    (message: string) => {
      toaster.add({ title: message, type: 'success' })
    },
    [toaster]
  )
  return { toaster, notifySuccess }
}
