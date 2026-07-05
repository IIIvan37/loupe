import { Trans, useLingui } from '@lingui/react/macro'
import { cx } from '../../lib/cx.ts'
import type { ShortcutHint } from '../keyboard/shortcut-hints.ts'
import styles from './empty-state.module.css'

interface EmptyStateProps {
  /** Open the file picker — the shell owns the hidden input. */
  readonly onImport: () => void
  /** The active keyboard layout, shown so the workflow is discoverable up front. */
  readonly shortcuts: readonly ShortcutHint[]
}

/**
 * The first-run hero shown while no track is loaded: a full-height drop-zone
 * prompting a drag or an import, with the keyboard layout on display so the
 * workstation reads as a tool, not a broken grey shell. The whole shell is the
 * drop target (see the shell's file-drop handlers); this is the visible cue.
 */
export function EmptyState({ onImport, shortcuts }: EmptyStateProps) {
  const { t } = useLingui()
  return (
    <main className={cx(styles.empty)} aria-labelledby="empty-headline">
      <div className={cx(styles.hero)}>
        <p className={cx(styles.badge)} aria-hidden="true">
          ⬓
        </p>
        <h2 id="empty-headline" className={cx(styles.headline)}>
          <Trans id="empty.headline">Glissez un fichier audio ici</Trans>
        </h2>
        <p className={cx(styles.sub)}>
          <Trans id="empty.sub">WAV, MP3, FLAC, M4A…</Trans>
        </p>
        <button
          type="button"
          className={cx(styles.action)}
          onClick={onImport}
        >
          {t({ id: 'empty.import', message: 'Importer un fichier' })}
        </button>
      </div>

      <dl className={cx(styles.shortcuts)}>
        {shortcuts.map((hint) => (
          <div key={hint.keys} className={cx(styles.row)}>
            <dt>
              <kbd className={cx(styles.kbd)}>{hint.keys}</kbd>
            </dt>
            <dd className={cx(styles.desc)}>{hint.description}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
