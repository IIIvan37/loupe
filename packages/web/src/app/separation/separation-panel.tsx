import type { SeparationState, StemSet } from '@app/core'
import styles from './separation-panel.module.css'

const PHASE_LABEL: Readonly<Record<'analysing' | 'separating', string>> = {
  analysing: 'Analyse du mix…',
  separating: 'Séparation des pistes…'
}

interface SeparationPanelProps {
  readonly state: SeparationState
  /** Whether a track is loaded and ready to be separated. */
  readonly canSeparate: boolean
  readonly onSeparate: () => void
}

/**
 * Dumb presentational panel for the import → separation moment: a single action
 * on the loaded track, a progress read-out while it runs, then — once ready —
 * the « Non détectés » line for the stems detection masked. The present stems
 * are the mixer's job (faders, waveforms). No second import: it acts on the
 * audio already in the player.
 */
export function SeparationPanel({
  state,
  canSeparate,
  onSeparate
}: SeparationPanelProps) {
  const isRunning = state.status === 'analysing' || state.status === 'separating'
  const percent = Math.round(state.progress * 100)
  // Offer the action only while there is something to do: hide it once the stems
  // are ready (a re-run needs a fresh import), keep it as a retry on failure.
  const canAct = !isRunning && state.status !== 'ready'

  return (
    <section className={styles.panel} aria-label="Séparation des pistes">
      <div className={styles.head}>
        <span className={styles.label}>Pistes séparées</span>
        {canAct && (
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

      {state.status === 'ready' && <UndetectedLine stems={state.stems} />}

      {state.status === 'idle' && (
        <p className={styles.hint}>
          Les pistes séparées (voix, batterie, basse…) s'alignent sous la forme
          d'onde, chacune avec ses propres contrôles.
        </p>
      )}
    </section>
  )
}

/** Name the stems adaptive detection masked as near-silent (nothing if none). */
function UndetectedLine({ stems }: { readonly stems: StemSet }) {
  const absent = stems.filter((stem) => !stem.present)
  if (absent.length === 0) {
    return null
  }
  return (
    <p className={styles.undetected}>
      <span className={styles.undetectedLabel}>Non détectés</span>{' '}
      <span>{absent.map((stem) => stem.label).join(' · ')}</span>
    </p>
  )
}
