import { cx } from '../../lib/cx.ts'
import { AppDialog } from '../ui/app-dialog.tsx'
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
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Raccourcis clavier"
      description="Disponibles une fois un morceau chargé."
    >
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
    </AppDialog>
  )
}
