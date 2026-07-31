import { useState } from 'react'

export interface DropImport {
  /** The dropped file's name while a confirmation is pending, else undefined. */
  readonly pendingName: string | undefined
  /** Route a dropped audio file: import now, or hold it for confirmation. */
  readonly onDropFile: (file: File) => void
  /** Import the held file (the user confirmed replacing unsaved work). */
  readonly confirm: () => void
  /** Discard the held file (the user kept the current session). */
  readonly cancel: () => void
}

/**
 * The drop → import decision: a dropped file imports straight away, unless the
 * session holds unsaved work — then it is held pending a confirmation dialog, so
 * a drag never silently discards work. Mirrors the picker's unsaved-work guard,
 * adapted to a one-shot gesture (a two-step arm can't ride a single drop).
 */
export function useDropImport(
  importFile: (file: File) => void,
  needsConfirm: boolean
): DropImport {
  const [pending, setPending] = useState<File | null>(null)

  function onDropFile(file: File): void {
    if (needsConfirm) {
      setPending(file)
    } else {
      importFile(file)
    }
  }

  function confirm(): void {
    if (pending) {
      importFile(pending)
      setPending(null)
    }
  }

  return {
    pendingName: pending?.name,
    onDropFile,
    confirm,
    cancel: () => setPending(null)
  }
}
