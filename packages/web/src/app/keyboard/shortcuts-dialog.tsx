import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import { i18n } from '../../i18n/i18n.ts'
import { AppDialog } from '../ui/app-dialog.tsx'
import type { ShortcutHint } from './shortcut-hints.ts'
import styles from './shortcuts-dialog.module.css'

interface ShortcutsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly hints: readonly ShortcutHint[]
}

/**
 * The pointer vocabulary, previously taught only through hover `title`s —
 * invisible on touch and to anyone who never hovers. Static rows: gestures
 * have no bindings to derive from.
 */
const GESTURES: ReadonlyArray<{
  readonly gesture: MessageDescriptor
  readonly action: MessageDescriptor
}> = [
  {
    gesture: msg({ id: 'shortcuts.gesture-click', message: 'Clic' }),
    action: msg({
      id: 'shortcuts.gesture-seek',
      message: "Se positionner sur la forme d'onde"
    })
  },
  {
    gesture: msg({ id: 'shortcuts.gesture-drag', message: 'Glisser' }),
    action: msg({
      id: 'shortcuts.gesture-loop',
      message:
        "Créer une boucle A/B sur la forme d'onde (Alt : sans aimantation)"
    })
  },
  {
    gesture: msg({ id: 'shortcuts.gesture-drag', message: 'Glisser' }),
    action: msg({
      id: 'shortcuts.gesture-marker',
      message: 'Déplacer un repère (clic : aller au repère, ←/→ : décaler)'
    })
  },
  {
    gesture: msg({ id: 'shortcuts.gesture-dblclick', message: 'Double-clic' }),
    action: msg({
      id: 'shortcuts.gesture-reset',
      message: 'Réinitialiser un curseur (vitesse, hauteur)'
    })
  }
]

/**
 * Dumb help dialog listing every keyboard shortcut. The rows are derived from
 * the active bindings upstream, so what's shown always matches what the keys
 * do. The pointer gestures follow as a static section — they have no bindings
 * to derive from.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
  hints
}: ShortcutsDialogProps) {
  const { t } = useLingui()
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={t({ id: 'shortcuts.title', message: 'Raccourcis clavier' })}
      description={t({
        id: 'shortcuts.availability',
        message: 'Disponibles une fois un morceau chargé.'
      })}
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
      <h3 className={cx(styles.gesturesTitle)}>
        {t({ id: 'shortcuts.gestures', message: 'Gestes' })}
      </h3>
      <dl className={cx(styles.list)}>
        {GESTURES.map((row) => (
          <div key={row.action.id} className={cx(styles.row)}>
            <dt className={cx(styles.keys, styles.gesture)}>
              {i18n._(row.gesture)}
            </dt>
            <dd className={cx(styles.action)}>{i18n._(row.action)}</dd>
          </div>
        ))}
      </dl>
    </AppDialog>
  )
}
