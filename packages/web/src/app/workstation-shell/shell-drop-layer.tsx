import { Trans } from '@lingui/react/macro'
import type { ChangeEvent, RefObject } from 'react'
import { ConfirmImportDialog } from './confirm-import-dialog.tsx'
import styles from './workstation-shell.module.css'

interface ShellDropLayerProps {
  /** The shared hidden file input — the header and empty-state click it. */
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  readonly onFilePicked: (event: ChangeEvent<HTMLInputElement>) => void
  readonly importLabel: string
  /** A file is dragged over the app — show the full-viewport drop cue. */
  readonly isDraggingFile: boolean
  /** A dropped file awaiting confirmation (unsaved work), else undefined. */
  readonly pendingName: string | undefined
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * The shell's import plumbing gathered in one place: the drag overlay cue, the
 * single hidden file input (shared by the header button and the empty-state
 * hero), and the unsaved-work confirmation for a dropped file.
 */
export function ShellDropLayer({
  fileInputRef,
  onFilePicked,
  importLabel,
  isDraggingFile,
  pendingName,
  onConfirm,
  onCancel
}: ShellDropLayerProps) {
  return (
    <>
      {isDraggingFile && (
        <div className={styles.dropOverlay} role="status">
          <span className={styles.dropOverlayInner}>
            <Trans id="drop.overlay">
              Déposez le fichier audio pour l'importer
            </Trans>
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className={styles.fileInput}
        aria-label={importLabel}
        onChange={onFilePicked}
      />
      <ConfirmImportDialog
        fileName={pendingName}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </>
  )
}
