import { Dialog } from '@base-ui-components/react/dialog'
import { cx } from '../../lib/cx.ts'
import type { ShortcutHint } from './shortcut-hints.ts'
import styles from './shortcuts-dialog.module.css'

interface ShortcutsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly hints: readonly ShortcutHint[]
}

/**
 * Dumb help dialog listing every keyboard shortcut. The rows are derived from
 * the active bindings upstream, so what's shown always matches what the keys do.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
  hints
}: ShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(styles.backdrop)} />
        <Dialog.Popup className={cx(styles.popup)}>
          <Dialog.Title className={cx(styles.title)}>
            Raccourcis clavier
          </Dialog.Title>
          <Dialog.Description className={cx(styles.description)}>
            Disponibles une fois un morceau chargé.
          </Dialog.Description>
          <dl className={cx(styles.list)}>
            {hints.map((hint) => (
              <div key={hint.keys} className={cx(styles.row)}>
                <dt className={cx(styles.keys)}>
                  <kbd className={cx(styles.kbd)}>{hint.keys}</kbd>
                </dt>
                <dd className={cx(styles.action)}>{hint.description}</dd>
              </div>
            ))}
          </dl>
          <Dialog.Close className={cx(styles.close)}>Fermer</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
