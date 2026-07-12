import { chartMatchesPitch } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { LiveStatus } from '../ui/live-status.tsx'
import { signedSemitones } from '../ui/signed-semitones.ts'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

/** The lead-sheet's default layout: four bars to a row, the lead-sheet norm. */
const DEFAULT_BARS_PER_ROW = 4
/** The layout bounds — beyond them the sheet stops reading as a grid. */
const MIN_BARS_PER_ROW = 1
const MAX_BARS_PER_ROW = 12

/** The detection surface the shell wires in (absent = feature not wired). */
export interface ChordDetectionProps {
  /** Why detection is unavailable (disables the button + explains under it). */
  readonly blockedReason: 'server' | 'no-grid' | undefined
  readonly detecting: boolean
  readonly error: string | undefined
  readonly succeeded: boolean
  readonly onDetect: (barsPerRow: number) => void
}

interface ChordChartPanelProps {
  readonly source: string
  readonly onSourceChange: (source: string) => void
  /** Transpose the whole grid by a signed number of semitones — the owner
   * rewrites the source AND accounts for the key change (`transposedBy`). */
  readonly onTranspose: (delta: number) => void
  /** The live audio pitch shift, in semitones (0 = original key). */
  readonly pitchSemitones: number
  /** How far the grid's key has been transposed from its written key. */
  readonly transposedBy: number
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
  onTranspose,
  pitchSemitones,
  transposedBy,
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
      ? t({
          id: 'chords.detect-needs-server',
          message: 'Lancer le serveur local pour détecter les accords.'
        })
      : detection?.blockedReason === 'no-grid'
        ? t({
            id: 'chords.detect-needs-grid',
            message:
              "Détecter d'abord le tempo — la grille de mesures ancre les accords."
          })
        : undefined

  // The failure copy stays in the catalog (Lot G: actionable, translated) —
  // the raw engine detail is appended visibly but never spoken alone.
  const failed =
    detection?.error !== undefined
      ? t({
          id: 'chords.detect-failed',
          message: 'Échec de la détection des accords'
        })
      : undefined

  // The « transposing instruments » gap: the audio plays in one key, the grid
  // shows another. Octave-equivalent keys name the same chords, so the flag
  // compares modulo 12; the button still applies the exact gap so the offset
  // accounting stays true to the audible shift.
  const pitchDrift = pitchSemitones - transposedBy
  const gridDiverges =
    source.trim().length > 0 && !chartMatchesPitch(transposedBy, pitchSemitones)
  const pitch = signedSemitones(pitchSemitones)
  const grid = signedSemitones(transposedBy)
  // Following rewrites the whole grid in one click — like the detected draft,
  // armed work deserves a « Confirmer ? » beat before being rewritten.
  const follow = useTwoStepConfirm<true>()
  const [followedAnnounce, setFollowedAnnounce] = useState<string | undefined>(
    undefined
  )

  function onFollowClick(): void {
    if (follow.pending === null) {
      follow.arm(true)
      return
    }
    follow.disarm()
    onTranspose(pitchDrift)
    setFollowedAnnounce(
      t({ id: 'chords.followed', message: 'Grille transposée' })
    )
  }

  const announced = detection?.detecting
    ? t({ id: 'chords.detecting', message: 'Détection des accords…' })
    : detection?.succeeded
      ? t({
          id: 'chords.detect-done',
          message: 'Grille pré-remplie depuis la détection'
        })
      : failed

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
            onClick={() => onTranspose(-1)}
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
            onClick={() => onTranspose(1)}
            aria-label={t({
              id: 'chords.transpose-up',
              message: 'Transposer un demi-ton vers le haut'
            })}
          >
            +½
          </button>
        </span>
      </div>
      {gridDiverges && (
        <div className={styles.pitchDrift}>
          <p className={styles.hint}>
            {t({
              id: 'chords.pitch-mismatch',
              message: `Audio transposé de ${pitch} demi-tons, grille de ${grid} — la grille ne suit pas.`
            })}
          </p>
          <button
            type="button"
            className={styles.followButton}
            onClick={onFollowClick}
            onBlur={follow.disarm}
          >
            {follow.pending
              ? t({
                  id: 'chords.follow-pitch-confirm',
                  message: 'Réécrire la grille ?'
                })
              : t({
                  id: 'chords.follow-pitch',
                  message: 'Transposer la grille pour suivre'
                })}
          </button>
        </div>
      )}
      {/* The panel's one live region, mounted outside the conditional rows:
          the flag row unmounts the instant the grid follows, but the
          announcement must still be spoken (detection states take over). */}
      <LiveStatus message={announced ?? followedAnnounce} />
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
          {detection.error !== undefined && (
            <p className={styles.error}>
              {failed} — {detection.error}
            </p>
          )}
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
