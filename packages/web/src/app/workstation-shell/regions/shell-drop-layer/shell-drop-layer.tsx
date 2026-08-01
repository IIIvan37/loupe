import { Trans } from '@lingui/react/macro'
import type { ChangeEvent, RefObject } from 'react'
import { OperationStatus } from '../../../ui/operation-status/operation-status.tsx'
import { ConfirmImportDialog } from '../confirm-import-dialog/confirm-import-dialog.tsx'
import type { BusyLine } from '../shell-busy.ts'
import styles from './shell-drop-layer.module.css'

interface ShellDropLayerProps {
  /** The shared hidden file input — the header and empty-state click it. */
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  readonly onFilePicked: (event: ChangeEvent<HTMLInputElement>) => void
  readonly importLabel: string
  /** A file is dragged over the app — show the full-viewport drop cue. */
  readonly isDraggingFile: boolean
  /**
   * What stands between the gesture and the ready workshop (AS.3): shown as
   * a full-viewport take-charge overlay — the promoted drop-cue pattern —
   * mirroring the header's busy line. Undefined when nothing loads.
   */
  readonly busy?: BusyLine | undefined
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
  busy,
  pendingName,
  onConfirm,
  onCancel
}: ShellDropLayerProps) {
  return (
    <>
      {isDraggingFile && (
        <output className={styles.dropOverlay}>
          <span className={styles.dropOverlayInner}>
            <Trans id="drop.overlay">
              Déposer le fichier audio pour l'importer
            </Trans>
          </span>
        </output>
      )}
      {/* The drag cue wins — both are full-viewport, only one may speak.
          Purely visual (aria-hidden): the announcement channels stay with
          the flows' own live regions, and a ticking percentage inside a
          live region would spam AT. pointer-events: none keeps the header's
          « Annuler » reachable underneath. */}
      {!isDraggingFile && busy !== undefined && (
        <div
          aria-hidden="true"
          data-testid="take-charge-overlay"
          className={styles.busyOverlay}
        >
          <div className={styles.busyOverlayInner}>
            <OperationStatus label={busy.label} progress={busy.progress} />
          </div>
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
