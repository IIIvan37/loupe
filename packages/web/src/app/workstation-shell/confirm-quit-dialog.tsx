import { Dialog } from '@base-ui-components/react/dialog'
import { Trans } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import dialogStyles from '../ui/app-dialog.module.css'
import styles from './confirm-import-dialog.module.css'

interface ConfirmQuitDialogProps {
  readonly open: boolean
  /** Quit for real, discarding the unsaved work. */
  readonly onConfirm: () => void
  /** Keep the session open; the app stays. */
  readonly onCancel: () => void
}

/**
 * AP.2 — the quit counterpart of the drop guard: the native close (red
 * button, Cmd+Q) was held open by the shell, this asks before letting it
 * through. Any dismissal (backdrop, Escape, « Annuler ») keeps the app open;
 * only « Quitter » closes. Same armed skin as every destructive second step.
 */
export function ConfirmQuitDialog({
  open,
  onConfirm,
  onCancel
}: ConfirmQuitDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(dialogStyles.backdrop)} />
        <Dialog.Popup className={cx(dialogStyles.popup)}>
          <Dialog.Title className={cx(dialogStyles.title)}>
            <Trans id="quit.confirm-title">Quitter sans enregistrer ?</Trans>
          </Dialog.Title>
          <Dialog.Description className={cx(dialogStyles.description)}>
            <Trans id="quit.confirm-body">
              Le travail non enregistré sera perdu.
            </Trans>
          </Dialog.Description>
          <div className={cx(styles.actions)}>
            <button
              type="button"
              className={cx(styles.cancel)}
              onClick={onCancel}
            >
              <Trans id="common.cancel">Annuler</Trans>
            </button>
            <button
              type="button"
              className={cx(styles.confirm)}
              onClick={onConfirm}
            >
              <Trans id="quit.confirm-quit">Quitter</Trans>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
