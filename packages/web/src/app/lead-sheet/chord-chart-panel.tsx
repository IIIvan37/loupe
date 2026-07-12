import { chartMatchesPitch, type ChordDetectionErrorCode } from '@app/core'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { LiveStatus } from '../ui/live-status.tsx'
import { signedSemitones } from '../ui/signed-semitones.ts'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import type { ChartHeaderData } from './chart-header.tsx'
import {
  DEFAULT_BARS_PER_ROW,
  isValidBarsPerRow,
  MAX_BARS_PER_ROW,
  MIN_BARS_PER_ROW,
  readStoredBarsPerRow,
  storeBarsPerRow
} from './bars-per-row-preference.ts'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

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
  /** Transpose the whole grid by a signed number of semitones — the owner
   * rewrites the source AND accounts for the key change (`transposedBy`). */
  readonly onTranspose: (delta: number) => void
  /** The live audio pitch shift, in semitones (0 = original key). */
  readonly pitchSemitones: number
  /** How far the grid's key has been transposed from its written key. */
  readonly transposedBy: number
  /** The measure being PLAYED (the n-th downbeat, counted through the
   * unrolled form — see LeadSheet), undefined to highlight nothing. */
  readonly currentMeasureIndex?: number | undefined
  readonly detection?: ChordDetectionProps | undefined
  /** The session-derived chart head (tags, BPM, bar length) — see LeadSheet. */
  readonly header?: ChartHeaderData | undefined
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
  detection,
  header
}: ChordChartPanelProps) {
  const { t } = useLingui()
  // A render preference, not chart data — it rides localStorage (per browser)
  // so the chosen layout survives reloads without touching the manifest.
  const [barsPerRow, setBarsPerRow] = useState(
    () => readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW
  )
  // The last deliberate choice — what an abandoned or rejected edit settles
  // back to on blur, so a mid-edit preview never clobbers the preference.
  const settledBars = useRef(barsPerRow)
  // What the field shows while being edited — an emptied or out-of-range
  // draft is no layout, so the sheet keeps the last committed value.
  const [barsDraft, setBarsDraft] = useState<string | undefined>(undefined)
  // Browsers surface unparseable number-input content as '' + validity
  // .badInput — without this flag that garbage would pass as « transient ».
  const [barsBadInput, setBarsBadInput] = useState(false)
  // An empty draft is a transient mid-edit state; only content that cannot
  // become a layout gets flagged (the old behaviour rejected silently).
  const barsDraftInvalid =
    barsBadInput ||
    (barsDraft !== undefined &&
      barsDraft !== '' &&
      !isValidBarsPerRow(Number(barsDraft)))
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
              setBarsBadInput(event.target.validity?.badInput ?? false)
              const bars = Number(event.target.value)
              // A live preview only — the choice settles (and persists) on
              // blur, so a rejected edit's prefix never sticks.
              if (isValidBarsPerRow(bars)) {
                setBarsPerRow(bars)
              }
            }}
            onBlur={() => {
              const bars = Number(barsDraft)
              if (barsDraft !== undefined && isValidBarsPerRow(bars)) {
                settledBars.current = bars
                storeBarsPerRow(bars)
              } else {
                setBarsPerRow(settledBars.current)
              }
              setBarsDraft(undefined)
              setBarsBadInput(false)
            }}
            aria-invalid={barsDraftInvalid || undefined}
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
        </div>
      )}
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
          header={header}
          currentMeasureIndex={currentMeasureIndex}
          barsPerRow={barsPerRow}
        />
      </div>
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
