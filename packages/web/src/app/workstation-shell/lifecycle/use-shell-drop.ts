import { useState } from 'react'
import { useDropImport } from './use-drop-import.ts'
import { type FileDrop, useFileDrop } from './use-file-drop.ts'

export interface ShellDropParams {
  /** The picker's exact import path — a dropped file goes through it too. */
  readonly importPickedFile: (file: File) => void
  /** Guards the drop behind the same unsaved-work confirmation as the button. */
  readonly unsavedWork: boolean
  /** The live import status — any import starting supersedes the warning. */
  readonly importStatus: 'idle' | 'loading' | 'loaded' | 'error'
}

export interface ShellDrop {
  readonly isDraggingFile: boolean
  readonly dropHandlers: FileDrop['dropHandlers']
  /** The file waiting behind the unsaved-work confirmation, if any. */
  readonly pendingName: string | undefined
  readonly confirm: () => void
  readonly cancel: () => void
  /** A drop held no audio file — show the dismissible warning. */
  readonly dropRejected: boolean
  readonly dismissRejected: () => void
}

/**
 * The whole native OS-file drop story in one hook: a dropped audio file
 * imports through the picker's exact path, guarded by the same unsaved-work
 * confirmation as the button; a drop holding no audio file raises a
 * dismissible warning instead of vanishing silently, cleared by the next
 * accepted drop or by any import that starts (picker, URL, project open) —
 * the latter adjusted during render, like the projects dialog's stale-confirm
 * disarm.
 */
export function useShellDrop(params: ShellDropParams): ShellDrop {
  const [dropRejected, setDropRejected] = useState(false)
  const dropImport = useDropImport(params.importPickedFile, params.unsavedWork)
  const { isDraggingFile, dropHandlers } = useFileDrop(
    (file) => {
      setDropRejected(false)
      dropImport.onDropFile(file)
    },
    () => setDropRejected(true)
  )
  if (dropRejected && params.importStatus === 'loading') {
    setDropRejected(false)
  }
  return {
    isDraggingFile,
    dropHandlers,
    pendingName: dropImport.pendingName,
    confirm: dropImport.confirm,
    cancel: dropImport.cancel,
    dropRejected,
    dismissRejected: () => setDropRejected(false)
  }
}
