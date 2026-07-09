import type { SeparationState } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { i18n } from '../../i18n/i18n.ts'
import type { ServerHealth } from '../../projects/use-server-health.ts'
import { LiveStatus } from '../ui/live-status.tsx'
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

/** Spoken (never shown) once the run lands: the stems ARE the visible cue. */
const DONE_LABEL = msg({ id: 'separation.done', message: 'Pistes séparées' })

interface SeparationPanelProps {
  readonly state: SeparationState
  /** Whether a track is loaded and ready to be separated. */
  readonly canSeparate: boolean
  /**
   * The local server's health. Separation runs on that server, so an `offline`
   * or `no-separation` server blocks the action — surfaced up front rather than
   * as a click → wait → error.
   */
  readonly serverHealth: ServerHealth
  readonly onSeparate: () => void
}

/** Server states that make separation impossible, with an actionable reason. */
const SERVER_BLOCK: Partial<Record<ServerHealth, MessageDescriptor>> = {
  offline: msg({
    id: 'separation.server-offline',
    message:
      'Serveur hors ligne — démarrer le serveur local pour séparer les pistes.'
  }),
  'no-separation': msg({
    id: 'separation.server-no-separation',
    message: 'Ce serveur ne fournit pas de moteur de séparation.'
  })
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
  serverHealth,
  onSeparate
}: SeparationPanelProps) {
  const { t } = useLingui()
  const isRunning = state.status === 'analysing' || state.status === 'separating'
  const percent = Math.round(state.progress * 100)
  const error = state.error
  // 'checking' is transient on boot; only the definitive bad states block, so
  // the button never flashes off then on while the first probe is in flight.
  const serverBlock = SERVER_BLOCK[serverHealth]
  // One resolution feeds both channels (live region + visible progress head).
  const stepLabel = isRunning ? i18n._(PROGRESS_LABELS[state.status]) : undefined
  const announced = state.status === 'ready' ? i18n._(DONE_LABEL) : stepLabel

  return (
    <>
      {/* The announcement channel outlives the visible panel: steps while the
          run is in flight (never the moving percentage — spam), completion
          once the stems are ready and the section below steps aside. */}
      <LiveStatus message={announced} />

      {/* Once ready the stems ARE the mixer (lanes + gutter headers, with the
          « Non détectés » caption among them), so the affordance has nothing
          left to show. Offer the action only while there is something to do:
          separate when idle, retry on failure. */}
      {state.status !== 'ready' && (
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
              disabled={!canSeparate || serverBlock !== undefined}
              onClick={onSeparate}
            >
              {state.status === 'error'
                ? t({ id: 'separation.retry', message: 'Réessayer' })
                : t({ id: 'separation.separate', message: 'Séparer les pistes' })}
            </button>
          )}

          {serverBlock !== undefined && (
            <p className={styles.hint}>{t(serverBlock)}</p>
          )}

          {isRunning && (
            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <span>{stepLabel}</span>
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

          {state.status === 'idle' && serverBlock === undefined && (
            <p className={styles.hint}>
              <Trans id="separation.idle-hint">
                Les pistes séparées (voix, batterie, basse…) s'alignent sous la
                forme d'onde, chacune avec ses propres contrôles.
              </Trans>
            </p>
          )}
        </section>
      )}
    </>
  )
}
