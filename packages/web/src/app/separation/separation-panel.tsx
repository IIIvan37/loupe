import type { SeparationState } from '@app/core'
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
 * Dumb presentational affordance for the import → separation moment: a single
 * action on the loaded track and a progress read-out while it runs. Sits at the
 * top of the column, near the import. Once the stems are ready they become the
 * mixer (faders, waveforms, lanes) and the « Non détectés » caption lives in the
 * mixer gutter, so this panel steps aside entirely. No second import: it acts on
 * the audio already in the player.
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

  // Once ready the stems ARE the mixer (lanes + gutter headers, with the
  // « Non détectés » caption among them), so the affordance has nothing left
  // to show. Offer the action only while there is something to do: separate
  // when idle, retry on failure.
  if (state.status === 'ready') {
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
      {!isRunning && (
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
