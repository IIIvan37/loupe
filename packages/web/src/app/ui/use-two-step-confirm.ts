import { useEffect, useRef, useState } from 'react'

/** How long an armed « Confirmer ? » stays armed before reverting. */
const CONFIRM_REVERT_MS = 4000

export interface TwoStepConfirm<T> {
  /** The armed value awaiting its second, confirming activation — or null. */
  readonly pending: T | null
  readonly arm: (value: T) => void
  readonly disarm: () => void
}

/**
 * The ephemeral state machine behind a two-step « Confirmer ? » action:
 * arming swaps the idle face for the confirm one, hesitation auto-reverts
 * after a few seconds, and the caller disarms on blur or on the confirming
 * activation itself.
 */
export function useTwoStepConfirm<T>(): TwoStepConfirm<T> {
  const [pending, setPending] = useState<T | null>(null)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  // Clear the revert timer on unmount so it never fires into a gone component.
  useEffect(() => () => clearTimeout(revertTimer.current), [])

  function disarm(): void {
    clearTimeout(revertTimer.current)
    setPending(null)
  }

  function arm(value: T): void {
    clearTimeout(revertTimer.current)
    setPending(value)
    revertTimer.current = setTimeout(() => setPending(null), CONFIRM_REVERT_MS)
  }

  return { pending, arm, disarm }
}
