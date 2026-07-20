import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx.ts'
import styles from './empty-state.module.css'

interface EmptyStateProps {
  /** Open the file picker — the shell owns the hidden input. */
  readonly onImport: () => void
}

/** A value hook that sells what loupe does — an icon, a title, and a one-line
 * benefit (AK.2, replacing the premature shortcut table; the shortcuts live on
 * in the « ? » dialog). */
interface ValueHook {
  readonly key: string
  readonly icon: ReactNode
  readonly title: ReactNode
  readonly benefit: ReactNode
}

// Static content — hoisted so it isn't rebuilt each render. The `<Trans>`
// elements resolve their copy at render time under the i18n provider.
const HOOKS: readonly ValueHook[] = [
  {
    key: 'separate',
    icon: <StemsIcon />,
    title: <Trans id="empty.hook-separate-title">Séparer les pistes</Trans>,
    benefit: (
      <Trans id="empty.hook-separate-desc">Isoler voix, basse, batterie…</Trans>
    )
  },
  {
    key: 'detect',
    icon: <AnalyseIcon />,
    title: (
      <Trans id="empty.hook-detect-title">Détecter accords &amp; tempo</Trans>
    ),
    benefit: (
      <Trans id="empty.hook-detect-desc">
        Grille d'accords et BPM automatiques
      </Trans>
    )
  },
  {
    key: 'loop',
    icon: <LoopIcon />,
    title: <Trans id="empty.hook-loop-title">Boucler &amp; ralentir</Trans>,
    benefit: (
      <Trans id="empty.hook-loop-desc">
        Répéter un passage, ralentir sans changer la hauteur
      </Trans>
    )
  }
]

/**
 * The first-run hero shown while no track is loaded: a full-height drop-zone
 * prompting a drag or an import, then three value hooks so the empty screen
 * sells what the tool does rather than showing a key reference up front. The
 * whole shell is the drop target (see the shell's file-drop handlers); this is
 * the visible cue.
 */
export function EmptyState({ onImport }: EmptyStateProps) {
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
        <button type="button" className={cx(styles.action)} onClick={onImport}>
          {t({ id: 'empty.import', message: 'Importer un fichier' })}
        </button>
      </div>

      <ul className={cx(styles.hooks)}>
        {HOOKS.map((hook) => (
          <li key={hook.key} className={cx(styles.hook)}>
            <span className={cx(styles.hookIcon)} aria-hidden="true">
              {hook.icon}
            </span>
            <p className={cx(styles.hookTitle)}>{hook.title}</p>
            <p className={cx(styles.hookDesc)}>{hook.benefit}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

/** Stacked lanes — the separated stems. */
function StemsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="3" rx="1.5" fill="currentColor" />
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="3" y="16" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

/** A bar spectrum — the automatic analysis. */
function AnalyseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="3" y="10" width="3" height="9" rx="1.5" fill="currentColor" />
      <rect x="8.5" y="6" width="3" height="13" rx="1.5" fill="currentColor" />
      <rect x="14" y="3" width="3" height="16" rx="1.5" fill="currentColor" />
      <rect x="19" y="12" width="2" height="7" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

/** Two arrows chasing — the practice loop. */
function LoopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H7a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h13a4 4 0 0 0 4-4v-1" />
    </svg>
  )
}
