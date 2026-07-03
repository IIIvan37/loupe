import type { SeparationState, StemSet } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { i18n } from '../../i18n/i18n.ts'
import styles from './separation-panel.module.css'

// Module-level map: lazy descriptors, resolved at render time via i18n._.
const PROGRESS_LABELS: Readonly<
  Record<'analysing' | 'separating', MessageDescriptor>
> = {
  analysing: msg({ id: 'separation.analysing', message: 'Analyse du mix…' }),
  separating: msg({
    id: 'separation.separating',
    message: 'Séparation des pistes…'
  })
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
  const { t } = useLingui()
  const isRunning = state.status === 'analysing' || state.status === 'separating'
  const percent = Math.round(state.progress * 100)
  const error = state.error
  // Offer the action only while there is something to do: hide it once the stems
  // are ready (a re-run needs a fresh import), keep it as a retry on failure.
  const canAct = !isRunning && state.status !== 'ready'

  // Once ready the stems live in the timeline (lanes + gutter headers); with
  // no masked stem to report either, the whole section would just dangle.
  if (state.status === 'ready' && state.stems.every((stem) => stem.present)) {
    return null
  }

  return (
    <section
      className={styles.panel}
      aria-label={t({
        id: 'separation.region-label',
        message: 'Séparation des pistes'
      })}
    >
      <div className={styles.head}>
        <span className={styles.label}>
          <Trans id="separation.ready">Pistes séparées</Trans>
        </span>
        {canAct && (
          <button
            type="button"
            className={styles.action}
            disabled={!canSeparate}
            onClick={onSeparate}
          >
            {state.status === 'error'
              ? t({ id: 'separation.retry', message: 'Réessayer' })
              : t({ id: 'separation.separate', message: 'Séparer les pistes' })}
          </button>
        )}
      </div>

      {isRunning && (
        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span>{i18n._(PROGRESS_LABELS[state.status])}</span>
            <span className={styles.percent}>{percent}%</span>
          </div>
          <progress className={styles.bar} value={percent} max={100}>
            {percent}%
          </progress>
        </div>
      )}

      {state.status === 'error' && (
        <p className={styles.error} role="alert">
          {t({
            id: 'separation.failed',
            message: `La séparation a échoué : ${error}`
          })}
        </p>
      )}

      {state.status === 'ready' && <UndetectedLine stems={state.stems} />}

      {state.status === 'idle' && (
        <p className={styles.hint}>
          <Trans id="separation.idle-hint">
            Les pistes séparées (voix, batterie, basse…) s'alignent sous la
            forme d'onde, chacune avec ses propres contrôles.
          </Trans>
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
      <span className={styles.undetectedLabel}>
        <Trans id="separation.undetected">Non détectés</Trans>
      </span>{' '}
      <span>{absent.map((stem) => stem.label).join(' · ')}</span>
    </p>
  )
}
