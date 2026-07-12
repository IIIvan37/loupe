import {
  type ChordDetectionErrorCode,
  transposeChartSource
} from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { LiveStatus } from '../ui/live-status.tsx'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

/** The lead-sheet's default layout: four bars to a row, the lead-sheet norm. */
const DEFAULT_BARS_PER_ROW = 4
/** The layout bounds — beyond them the sheet stops reading as a grid. */
const MIN_BARS_PER_ROW = 1
const MAX_BARS_PER_ROW = 12

/** Blocked-state hints, shared with the failure copy below. */
const NEEDS_SERVER = msg({
  id: 'chords.detect-needs-server',
  message: 'Lancer le serveur local pour détecter les accords.'
})
const NEEDS_GRID = msg({
  id: 'chords.detect-needs-grid',
  message: "Détecter d'abord le tempo — la grille de mesures ancre les accords."
})

/**
 * One actionable, translated line per failure code (Lot G standard) — the raw
 * engine/transport detail never reaches the UI (the hook logs it to the
 * console). `network` and `no-downbeat` reuse the blocked-state hints: same
 * user situation, same words.
 */
const ERROR_COPY: Readonly<Record<ChordDetectionErrorCode, MessageDescriptor>> =
  {
    'no-downbeat': NEEDS_GRID,
    'no-chords': msg({
      id: 'chords.error.no-chords',
      message: 'Aucun accord détecté sur ce morceau.'
    }),
    'engine-unavailable': msg({
      id: 'chords.error.engine-unavailable',
      message:
        "Le moteur d'accords n'est pas installé sur le serveur — voir server/README."
    }),
    network: NEEDS_SERVER,
    timeout: msg({
      id: 'chords.error.timeout',
      message: "L'analyse des accords a expiré sur le serveur — réessayer."
    }),
    'too-large': msg({
      id: 'chords.error.too-large',
      message: "Piste trop volumineuse pour l'analyse sur le serveur."
    }),
    unknown: msg({
      id: 'chords.error.unknown',
      message: 'Erreur inattendue — détails dans la console du navigateur.'
    })
  }

/** The detection surface the shell wires in (absent = feature not wired). */
export interface ChordDetectionProps {
  /** Why detection is unavailable (disables the button + explains under it). */
  readonly blockedReason: 'server' | 'no-grid' | undefined
  readonly detecting: boolean
  /** Why the last run failed — a code the panel maps to translated copy. */
  readonly error: ChordDetectionErrorCode | undefined
  readonly succeeded: boolean
  readonly onDetect: (barsPerRow: number) => void
}

interface ChordChartPanelProps {
  readonly source: string
  readonly onSourceChange: (source: string) => void
  /** The measure being played (global index), undefined to highlight nothing. */
  readonly currentMeasureIndex?: number | undefined
  readonly detection?: ChordDetectionProps | undefined
}

/**
 * Manual chord-chart entry: type the grid in the home text format and watch the
 * lead-sheet render live above it. Dumb — the source text is session state
 * owned by the shell (`useChordChart`), so it survives the panel unmounting
 * and rides the project save/open lifecycle. Transposing rewrites that same
 * source (layout preserved), so the result persists like any edit.
 */
export function ChordChartPanel({
  source,
  onSourceChange,
  currentMeasureIndex,
  detection
}: ChordChartPanelProps) {
  const { t } = useLingui()
  // A render preference, not chart data — it lives with the panel (resets
  // with it on track change) and is never persisted.
  const [barsPerRow, setBarsPerRow] = useState(DEFAULT_BARS_PER_ROW)
  // What the field shows while being edited — an emptied or out-of-range
  // draft is no layout, so the sheet keeps the last committed value.
  const [barsDraft, setBarsDraft] = useState<string | undefined>(undefined)
  // The detected draft REPLACES the source — a non-empty grid is armed work,
  // so the first activation only swaps the button to « Confirmer ? ».
  const overwrite = useTwoStepConfirm<true>()

  function onDetectClick(): void {
    if (!detection) {
      return
    }
    if (source.trim().length > 0 && overwrite.pending === null) {
      overwrite.arm(true)
      return
    }
    overwrite.disarm()
    detection.onDetect(barsPerRow)
  }

  const blockedHint =
    detection?.blockedReason === 'server'
      ? t(NEEDS_SERVER)
      : detection?.blockedReason === 'no-grid'
        ? t(NEEDS_GRID)
        : undefined

  // The full failure line — shown AND announced, so a screen-reader user
  // hears the same actionable reason a sighted user reads.
  const failureLine =
    detection?.error !== undefined
      ? `${t({
          id: 'chords.detect-failed',
          message: 'Échec de la détection des accords'
        })} — ${t(ERROR_COPY[detection.error])}`
      : undefined

  const announced = detection?.detecting
    ? t({ id: 'chords.detecting', message: 'Détection des accords…' })
    : detection?.succeeded
      ? t({
          id: 'chords.detect-done',
          message: 'Grille pré-remplie depuis la détection'
        })
      : failureLine

  return (
    <section className={styles.panel}>
      {/* Not a <header>: Testing Library's role mapper would still expose it
          as a second `banner` landmark beside the app header. */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {t({ id: 'chords.title', message: "Grille d'accords" })}
        </h2>
        <span className={styles.layout}>
          <input
            type="number"
            className={styles.barsField}
            inputMode="numeric"
            min={MIN_BARS_PER_ROW}
            max={MAX_BARS_PER_ROW}
            value={barsDraft ?? barsPerRow}
            onChange={(event) => {
              setBarsDraft(event.target.value)
              const bars = Number(event.target.value)
              if (
                Number.isInteger(bars) &&
                bars >= MIN_BARS_PER_ROW &&
                bars <= MAX_BARS_PER_ROW
              ) {
                setBarsPerRow(bars)
              }
            }}
            onBlur={() => setBarsDraft(undefined)}
            aria-label={t({
              id: 'chords.bars-per-row',
              message: 'Mesures par ligne'
            })}
          />
          {t({ id: 'chords.bars-per-row-unit', message: 'mes. / ligne' })}
        </span>
        <span className={styles.transpose}>
          <button
            type="button"
            className={styles.transposeButton}
            onClick={() => onSourceChange(transposeChartSource(source, -1))}
            aria-label={t({
              id: 'chords.transpose-down',
              message: 'Transposer un demi-ton vers le bas'
            })}
          >
            −½
          </button>
          <button
            type="button"
            className={styles.transposeButton}
            onClick={() => onSourceChange(transposeChartSource(source, 1))}
            aria-label={t({
              id: 'chords.transpose-up',
              message: 'Transposer un demi-ton vers le haut'
            })}
          >
            +½
          </button>
        </span>
      </div>
      {/* A detected chart spans the whole track (~120 measures in one click):
          the scrollport bounds the sheet so it never stretches the page and
          pushes the transport out of the viewport (K.1). */}
      <div className={styles.sheetViewport}>
        <LeadSheet
          source={source}
          currentMeasureIndex={currentMeasureIndex}
          barsPerRow={barsPerRow}
        />
      </div>
      {detection && (
        <div className={styles.detectRow}>
          <button
            type="button"
            className={styles.detectButton}
            disabled={
              detection.blockedReason !== undefined || detection.detecting
            }
            onClick={onDetectClick}
            onBlur={overwrite.disarm}
          >
            {detection.detecting
              ? t({ id: 'chords.detecting', message: 'Détection des accords…' })
              : overwrite.pending
                ? t({
                    id: 'chords.detect-confirm',
                    message: 'Remplacer la grille ?'
                  })
                : t({ id: 'chords.detect', message: 'Détecter les accords' })}
          </button>
          {blockedHint !== undefined && (
            <p className={styles.hint}>{blockedHint}</p>
          )}
          {failureLine !== undefined && (
            <p className={styles.error}>{failureLine}</p>
          )}
          <LiveStatus message={announced} />
        </div>
      )}
      <textarea
        className={styles.input}
        value={source}
        onChange={(event) => onSourceChange(event.target.value)}
        rows={6}
        spellCheck={false}
        aria-label={t({
          id: 'chords.input-label',
          message: "Saisir la grille d'accords"
        })}
        placeholder={t({
          id: 'chords.placeholder',
          message: '[Couplet]\n| C | Am | F | G |'
        })}
      />
    </section>
  )
}
