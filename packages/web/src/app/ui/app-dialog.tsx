import { Trans } from '@lingui/react/macro'
import { Dialog } from '@base-ui-components/react/dialog'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './app-dialog.module.css'

interface AppDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly children: ReactNode
  /** A wider panel for content that reads better in two columns (shortcuts) or
   * needs room (project names). Defaults to the compact width. */
  readonly wide?: boolean
}

/**
 * Dumb modal frame shared by the app's dialogs: backdrop, centred panel, title,
 * description, the caller's content, and a « Fermer » action.
 */
export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false
}: AppDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(styles.backdrop)} />
        <Dialog.Popup className={cx(styles.popup, wide && styles.wide)}>
          <Dialog.Title className={cx(styles.title)}>{title}</Dialog.Title>
          <Dialog.Description className={cx(styles.description)}>
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close className={cx(styles.close)}>
            <Trans id="common.close">Fermer</Trans>
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
