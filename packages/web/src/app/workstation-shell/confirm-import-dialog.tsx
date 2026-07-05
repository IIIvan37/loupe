import { Dialog } from '@base-ui-components/react/dialog'
import { Trans, useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import dialogStyles from '../ui/app-dialog.module.css'
import styles from './confirm-import-dialog.module.css'

interface ConfirmImportDialogProps {
  /** The dropped file's name — its presence opens the dialog. */
  readonly fileName: string | undefined
  /** Import the held file, replacing the unsaved session. */
  readonly onConfirm: () => void
  /** Keep the current session; discard the drop. */
  readonly onCancel: () => void
}

/**
 * Guards a dropped file against discarding unsaved work: a one-shot drop can't
 * ride the header's two-step « Confirmer ? », so it holds the file and asks
 * here. Any dismissal (backdrop, Escape, « Annuler ») cancels; only « Importer »
 * replaces the session.
 */
export function ConfirmImportDialog({
  fileName,
  onConfirm,
  onCancel
}: ConfirmImportDialogProps) {
  const { t } = useLingui()
  return (
    <Dialog.Root
      open={fileName !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(dialogStyles.backdrop)} />
        <Dialog.Popup className={cx(dialogStyles.popup)}>
          <Dialog.Title className={cx(dialogStyles.title)}>
            <Trans id="drop.confirm-title">Remplacer la session ?</Trans>
          </Dialog.Title>
          <Dialog.Description className={cx(dialogStyles.description)}>
            {t({
              id: 'drop.confirm-body',
              message: `« ${fileName ?? ''} » remplacera le travail non enregistré.`
            })}
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
              <Trans id="drop.confirm-import">Importer</Trans>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
