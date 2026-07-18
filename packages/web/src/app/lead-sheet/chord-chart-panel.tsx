import { chartMatchesPitch, parseChart } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { exportsUnavailableOnDesktop } from '../desktop/desktop-export.ts'
import { LiveStatus } from '../ui/live-status.tsx'
import { signedSemitones } from '../ui/signed-semitones.ts'
import { useTwoStepConfirm } from '../ui/use-two-step-confirm.ts'
import type { ChartHeaderData } from './chart-header.tsx'
import { BarsPerRowField } from './bars-per-row-field.tsx'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow
} from './bars-per-row-preference.ts'
import { chartHasContent } from './chart-content.ts'
import { FormatHelpDialog } from './format-help-dialog.tsx'
import { LeadSheet } from './lead-sheet.tsx'
import styles from './chord-chart-panel.module.css'

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
  /** The session-derived chart head (tags, BPM, bar length) — see LeadSheet. */
  readonly header?: ChartHeaderData | undefined
  /** Tap a measure to seek playback to it — see LeadSheet. */
  readonly onSelectMeasure?: ((writtenIndex: number) => void) | undefined
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
  header,
  onSelectMeasure
}: ChordChartPanelProps) {
  const { t } = useLingui()
  // A render preference, not chart data — it rides localStorage (per browser)
  // so the chosen layout survives reloads without touching the manifest.
  const [barsPerRow, setBarsPerRow] = useState(
    () => readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW
  )
  // The chart is the view; the source editor is a mode, folded by default
  // (P.3). View state only — the source itself stays lifted in the shell.
  const [editing, setEditing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  // Ties the disclosure button to the region it reveals (aria-controls): the
  // textarea sits far below the toggle in the DOM, AT needs the link.
  const editorId = useId()
  useEffect(() => {
    // Unfolding is an explicit request to type — hand the editor the focus
    // (an effect, not autoFocus: the mount is user-triggered, not page load).
    if (editing) {
      editorRef.current?.focus()
    }
  }, [editing])
  // What « Imprimer » guards on: the sheet parses the same source anyway, so
  // one extra parse per source change is nothing — no lifted state needed.
  const printable = useMemo(
    () => chartHasContent(parseChart(source)),
    [source]
  )
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

  return (
    <section className={styles.panel}>
      {/* Not a <header>: Testing Library's role mapper would still expose it
          as a second `banner` landmark beside the app header. */}
      <div className={styles.header}>
        {/* h3: the panel title steps down under its zone's h2 (Partition) —
            the outline mirrors the section nesting Q.1 introduced. */}
        <h3 className={styles.title}>
          {t({ id: 'chords.title', message: "Grille d'accords" })}
        </h3>
        <BarsPerRowField value={barsPerRow} onChange={setBarsPerRow} />
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
        <button
          type="button"
          className={styles.printButton}
          // A source that renders no chart would print a blank page — the
          // action waits for content, the same test the sheet uses to emit
          // its print region. window.print() has no delegate in the desktop
          // webview (AH.1): disabled with a hint, never a silent no-op.
          disabled={!printable || exportsUnavailableOnDesktop()}
          title={
            exportsUnavailableOnDesktop()
              ? t({
                  id: 'chords.print-desktop-soon',
                  message:
                    "Impression bientôt disponible sur l'app de bureau"
                })
              : undefined
          }
          onClick={() => window.print()}
        >
          {t({ id: 'chords.print', message: 'Imprimer' })}
        </button>
        <button
          type="button"
          className={styles.editToggle}
          aria-expanded={editing}
          aria-controls={editorId}
          onClick={() => setEditing((open) => !open)}
        >
          {t({ id: 'chords.edit', message: 'Modifier' })}
        </button>
        <button
          type="button"
          className={styles.helpButton}
          onClick={() => setHelpOpen(true)}
        >
          {t({ id: 'chords.format-help', message: 'Aide du format' })}
        </button>
      </div>
      <FormatHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
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
          announcement must still be spoken. */}
      <LiveStatus message={followedAnnounce} />
      {/* A detected chart spans the whole track (~120 measures in one click):
          the scrollport bounds the sheet so it never stretches the page and
          pushes the transport out of the viewport (K.1). The marker declares
          it as THE box the sheet's playhead follow may scroll — and no other. */}
      <div className={styles.sheetViewport} data-sheet-scrollport>
        <LeadSheet
          source={source}
          header={header}
          currentMeasureIndex={currentMeasureIndex}
          onSelectMeasure={onSelectMeasure}
          barsPerRow={barsPerRow}
        />
      </div>
      {/* The always-visible textarea used to teach the grid format via its
          placeholder; folded away, an empty panel would show nothing at all —
          this line re-establishes the first-run guidance. */}
      {!editing && source.trim().length === 0 && (
        <p className={styles.hint}>
          {t({
            id: 'chords.empty-hint',
            message:
              'Aucune grille — saisir les accords via « Modifier » ou lancer la détection.'
          })}
        </p>
      )}
      {editing && (
        <textarea
          ref={editorRef}
          id={editorId}
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
      )}
    </section>
  )
}
