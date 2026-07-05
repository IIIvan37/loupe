import { type DragEvent, useCallback, useRef, useState } from 'react'
import { pickAudioFile } from '../../lib/pick-audio-file.ts'

export interface FileDrop {
  /** A file is currently dragged over the surface — cue the drop overlay. */
  readonly isDraggingFile: boolean
  /** Spread onto the full-surface region that should accept OS file drops. */
  readonly dropHandlers: {
    readonly onDragEnter: (event: DragEvent) => void
    readonly onDragOver: (event: DragEvent) => void
    readonly onDragLeave: (event: DragEvent) => void
    readonly onDrop: (event: DragEvent) => void
  }
}

/** A drag carries files (vs. dragged text/links) — the only kind we react to. */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/**
 * Native OS-file-drop as a humble hook: it tracks whether a file is being
 * dragged over the surface (via a dragenter/dragleave depth counter, so
 * crossing into a child never flickers the overlay off) and, on drop, hands the
 * first audio file to `onFile`. Non-file drags and non-audio drops are ignored.
 * All decidable logic lives in the pure `pickAudioFile`.
 */
export function useFileDrop(onFile: (file: File) => void): FileDrop {
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  // dragenter/dragleave fire per element, including children — count the depth
  // so the overlay only clears when the drag has truly left the surface.
  const depth = useRef(0)

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!carriesFiles(event)) {
      return
    }
    event.preventDefault()
    depth.current += 1
    setIsDraggingFile(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    if (carriesFiles(event)) {
      // Required for `drop` to fire and to show the copy cursor.
      event.preventDefault()
    }
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!carriesFiles(event)) {
      return
    }
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) {
      setIsDraggingFile(false)
    }
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      depth.current = 0
      setIsDraggingFile(false)
      const file = pickAudioFile(Array.from(event.dataTransfer?.files ?? []))
      if (file) {
        onFile(file)
      }
    },
    [onFile]
  )

  return {
    isDraggingFile,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop }
  }
}
