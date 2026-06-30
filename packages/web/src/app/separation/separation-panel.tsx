import type { SeparationState, StemSet } from '@app/core'
import { Stack } from '../../layout/stack/stack.tsx'
import styles from './separation-panel.module.css'

/** Map each stem id to its reserved design-system colour (teal as a fallback). */
const STEM_COLOR: Readonly<Record<string, string>> = {
  voix: 'var(--stem-vocals)',
  batterie: 'var(--stem-drums)',
  basse: 'var(--stem-bass)',
  // The htdemucs « other » bucket (everything that is not voice/drums/bass).
  autres: 'var(--stem-other)',
  guitare: 'var(--stem-guitar)',
  claviers: 'var(--stem-keys)'
}

const PHASE_LABEL: Readonly<Record<'analysing' | 'separating', string>> = {
  analysing: 'Analyse du mix…',
  separating: 'Séparation des pistes…'
}

interface SeparationPanelProps {
  readonly state: SeparationState
  /** Whether a track is loaded and ready to be separated. */
  readonly canSeparate: boolean
  readonly onSeparate: () => void
  /** Download one separated stem as a WAV. */
  readonly onDownloadStem: (id: string) => void
}

/**
 * Dumb presentational panel for the import → separation moment: a single action
 * on the loaded track, a progress read-out while it runs, then the list of
 * separated stems. No second import — it acts on the audio already in the player.
 */
export function SeparationPanel({
  state,
  canSeparate,
  onSeparate,
  onDownloadStem
}: SeparationPanelProps) {
  const isRunning = state.status === 'analysing' || state.status === 'separating'
  const percent = Math.round(state.progress * 100)

  return (
    <section className={styles.panel} aria-label="Séparation des pistes">
      <div className={styles.head}>
        <span className={styles.label}>Pistes séparées</span>
        {!isRunning && (
          <button
            type="button"
            className={styles.action}
            disabled={!canSeparate}
            onClick={onSeparate}
          >
            {state.status === 'error' ? 'Réessayer' : 'Séparer les pistes'}
          </button>
        )}
      </div>

      {isRunning && (
        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span>{PHASE_LABEL[state.status]}</span>
            <span className={styles.percent}>{percent}%</span>
          </div>
          <progress className={styles.bar} value={percent} max={100}>
            {percent}%
          </progress>
        </div>
      )}

      {state.status === 'error' && (
        <p className={styles.error} role="alert">
          La séparation a échoué : {state.error}
        </p>
      )}

      {state.status === 'ready' && (
        <ReadyStems stems={state.stems} onDownloadStem={onDownloadStem} />
      )}

      {state.status === 'idle' && (
        <div className={styles.empty} aria-hidden="true" />
      )}
    </section>
  )
}

interface ReadyStemsProps {
  readonly stems: StemSet
  readonly onDownloadStem: (id: string) => void
}

/**
 * The ready result, split by adaptive detection: the instruments actually
 * present (each with a teal machine-confidence badge) as a track list, and a
 * single muted line naming the stems detection masked as near-silent.
 */
function ReadyStems({ stems, onDownloadStem }: ReadyStemsProps) {
  const present = stems.filter((stem) => stem.present)
  const absent = stems.filter((stem) => !stem.present)

  return (
    <Stack gap="var(--space-2xs)">
      <ul className={styles.stems}>
        {present.map((stem) => (
          <li key={stem.id} className={styles.stem}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: STEM_COLOR[stem.id] ?? 'var(--teal)' }}
              aria-hidden="true"
            />
            <span className={styles.stemLabel}>{stem.label}</span>
            <span
              className={styles.confidence}
              title={`Confiance de détection : ${Math.round(stem.confidence * 100)} %`}
            >
              {Math.round(stem.confidence * 100)} %
            </span>
            <button
              type="button"
              className={styles.download}
              aria-label={`Télécharger ${stem.label} en WAV`}
              onClick={() => onDownloadStem(stem.id)}
            >
              WAV ↓
            </button>
          </li>
        ))}
      </ul>

      {absent.length > 0 && (
        <p className={styles.undetected}>
          <span className={styles.undetectedLabel}>Non détectés</span>{' '}
          <span>{absent.map((stem) => stem.label).join(' · ')}</span>
        </p>
      )}
    </Stack>
  )
}
