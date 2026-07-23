import { Trans, useLingui } from '@lingui/react/macro'
import {
  type BeatGrid,
  formatTimecode,
  type LoopRegion,
  type Waveform
} from '@app/core'
import { clamp01 } from '../../lib/clamp01.ts'
import { OperationStatus } from '../ui/operation-status.tsx'
import type { ImportState } from './use-player.ts'
import {
  draggingPair,
  floatingEdgeRatio,
  selectionPair,
  useWaveformGestures
} from './use-waveform-gestures.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: ImportState
  /** The active loop, for the « loupe » dim overlay and the A/B edit handles. */
  readonly loopRegion: LoopRegion | undefined
  /** Whether the region loops: dims outside when on, just outlines it when off. */
  readonly loopEnabled: boolean
  /** The detected beat grid, drawn as vertical lines (downbeats stronger). */
  readonly beatGrid: BeatGrid
  /**
   * The summed mix envelope — the stems folded back into one waveform of the
   * audible mix (muting a stem carves it out here). Replaces the single track
   * envelope once separated; undefined for an un-separated track (which shows
   * its one amber waveform). The individual stems live in their own lanes.
   */
  readonly mixWaveform: Waveform | undefined
  readonly durationSeconds: number
  /** Click (no drag) seeks to a fraction (0–1) of the timeline. */
  readonly onSeek: (ratio: number) => void
  /**
   * A fresh surface drag selects a new (unsaved) A/B region, fractions 0–1.
   * `snap` asks for beat-grid snapping — true at drag end unless Alt is held
   * (the DAW escape hatch).
   */
  readonly onSelectRegion: (
    startRatio: number,
    endRatio: number,
    snap: boolean
  ) => void
  /** Moving a handle (or arrow-nudging it) adjusts the existing region in place. */
  readonly onAdjustRegion: (
    startRatio: number,
    endRatio: number,
    snap: boolean
  ) => void
  /** Open the file picker again — the way out of a failed import. */
  readonly onReimport: () => void
}

/**
 * The centrepiece envelope, split at the playhead (AO.1): a muted « à venir »
 * base carries the accessible name; a vivid amber→teal « lu » copy sits above,
 * clipped to the played fraction via the stage's --playhead-ratio variable —
 * paint-only per frame, no React on the tick path.
 */
function SplitWaveform({
  waveform,
  label
}: {
  readonly waveform: Waveform
  readonly label: string
}) {
  return (
    <div className={styles.waveStack}>
      <WaveformCanvas waveform={waveform} label={label} tone="upcoming" />
      <div
        className={styles.playedClip}
        data-testid="waveform-played"
        aria-hidden="true"
      >
        <WaveformCanvas waveform={waveform} label="" tone="played" decorative />
      </div>
    </div>
  )
}

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and — once loaded — the amber waveform
 * with click-to-seek, drag-to-select (the « loupe »), a live selection preview,
 * draggable A/B edge handles, and a dim overlay outside the active loop. It fills
 * its `ZoomStage` layer, so its 0–1 coordinates are whole-timeline ratios at any
 * zoom; the playhead and scrolling are the stage's. The pointer/keyboard gesture
 * bookkeeping lives in `useWaveformGestures`.
 */
export function WaveformView({
  state,
  loopRegion,
  loopEnabled,
  beatGrid,
  mixWaveform,
  durationSeconds,
  onSeek,
  onSelectRegion,
  onAdjustRegion,
  onReimport
}: WaveformViewProps) {
  const { t } = useLingui()
  const gestures = useWaveformGestures({
    durationSeconds,
    beatGrid,
    onSeek,
    onSelectRegion,
    onAdjustRegion
  })

  switch (state.status) {
    case 'idle':
      return (
        <p className={styles.hint}>
          <Trans id="waveform.import-hint">
            Importer un fichier audio pour afficher sa forme d'onde.
          </Trans>
        </p>
      )
    case 'loading':
      // The shared operation face (R.1) — no cancel: decodeAudioData is not
      // abortable. Short (1-5 s) but systematic: every import and reopen.
      // The wrapper keeps the stage gutter its idle/error siblings wear.
      return (
        <div className={styles.loading}>
          <OperationStatus
            label={t({ id: 'waveform.decoding', message: 'Décodage…' })}
          />
        </div>
      )
    case 'error':
      return <ImportErrorStage message={state.message} onReimport={onReimport} />
    case 'loaded': {
      const { drag, focusedEdge, hoverRatio, snapFlash } = gestures
      const committed = loopRatios(loopRegion, durationSeconds)
      // The edge drag previews live; otherwise the region/handles follow state.
      const region = draggingPair(drag) ?? committed
      const selection = selectionPair(drag)
      // The edge whose timecode floats: the one being dragged (its live raw
      // value) or the focused one (its committed value), else nothing.
      const edgeRatio = floatingEdgeRatio(drag, focusedEdge, committed)

      return (
        <div
          ref={gestures.containerRef}
          className={styles.container}
          onPointerMove={gestures.onPointerMove}
          onPointerUp={gestures.onPointerUp}
          onPointerLeave={gestures.clearHover}
        >
          {/* Pointer-only gesture surface (click = seek, drag = loop, Alt
              escapes the snap) — documented in the « ? » help's Gestures
              section. Deliberately NOT a button: it promised an Enter action
              it never had (the keyboard path is arrows/L/handle nudges). */}
          <div
            className={styles.surface}
            data-testid="waveform-surface"
            onPointerDown={gestures.beginSelect}
          >
            {mixWaveform ? (
              <SplitWaveform
                waveform={mixWaveform}
                label={t({
                  id: 'waveform.mix-image',
                  message: "Forme d'onde du mix"
                })}
              />
            ) : (
              <SplitWaveform
                waveform={state.track.waveform}
                label={t({
                  id: 'waveform.track-image',
                  message: "Forme d'onde de la piste"
                })}
              />
            )}
          </div>

          {durationSeconds > 0 && (
            <BeatLines beatGrid={beatGrid} durationSeconds={durationSeconds} />
          )}

          {snapFlash?.ratios.map((ratio, index) => (
            <span
              // The token remounts the span so the one-shot pulse replays on a
              // repeat snap to the same beat.
              key={`${snapFlash.token}-${index}`}
              className={styles.snapFlash}
              data-testid="snap-flash"
              style={{ left: `${clamp01(ratio) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          {region && (
            <>
              {loopEnabled ? (
                <>
                  <span
                    className={styles.dim}
                    style={{ left: 0, width: `${region.start * 100}%` }}
                    aria-hidden="true"
                  />
                  <span
                    className={styles.dim}
                    style={{ left: `${region.end * 100}%`, right: 0 }}
                    aria-hidden="true"
                  />
                </>
              ) : (
                <span
                  className={styles.region}
                  style={{
                    left: `${region.start * 100}%`,
                    width: `${(region.end - region.start) * 100}%`
                  }}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                className={styles.handle}
                style={{ left: `${region.start * 100}%` }}
                aria-label={t({
                  id: 'waveform.move-loop-start',
                  message: 'Déplacer le début de la boucle'
                })}
                onPointerDown={(event) => gestures.beginEdge(event, 'start', region)}
                onPointerMove={(event) => gestures.moveEdge('start', event.clientX)}
                onKeyDown={(event) => gestures.onHandleKeyDown(event, 'start', region)}
                onFocus={() => gestures.focusEdge('start')}
                onBlur={gestures.blurEdge}
              />
              <button
                type="button"
                className={styles.handle}
                style={{ left: `${region.end * 100}%` }}
                aria-label={t({
                  id: 'waveform.move-loop-end',
                  message: 'Déplacer la fin de la boucle'
                })}
                onPointerDown={(event) => gestures.beginEdge(event, 'end', region)}
                onPointerMove={(event) => gestures.moveEdge('end', event.clientX)}
                onKeyDown={(event) => gestures.onHandleKeyDown(event, 'end', region)}
                onFocus={() => gestures.focusEdge('end')}
                onBlur={gestures.blurEdge}
              />
            </>
          )}

          {selection && (
            <span
              className={styles.selection}
              style={{
                left: `${selection.start * 100}%`,
                width: `${(selection.end - selection.start) * 100}%`
              }}
              aria-hidden="true"
            />
          )}

          <FloatingTimecodes
            edgeRatio={edgeRatio}
            hoverRatio={hoverRatio}
            durationSeconds={durationSeconds}
          />
        </div>
      )
    }
  }
}

/**
 * The failed-import stage: a plain-words explanation (the decoder's message is
 * technical and untranslated — kept as the diagnostic detail) and the way out,
 * straight back into the file picker.
 */
function ImportErrorStage({
  message,
  onReimport
}: {
  readonly message: string
  readonly onReimport: () => void
}) {
  return (
    <div className={styles.errorStage}>
      <p role="alert" className={styles.error}>
        <Trans id="waveform.import-error">
          L'import a échoué : ce fichier n'a pas pu être lu.
        </Trans>
      </p>
      <p className={styles.errorDetail}>{message}</p>
      <button type="button" className={styles.reimport} onClick={onReimport}>
        <Trans id="waveform.reimport">Importer un autre fichier</Trans>
      </button>
    </div>
  )
}

/**
 * The two floating timecodes over the surface: the active loop edge (during a
 * drag or while its handle holds focus) pinned to its boundary, and the idle
 * hover cursor line with the timecode under the pointer. Both are decorative —
 * the numbers are echoed as accessible text in the loop controls and transport.
 */
function FloatingTimecodes({
  edgeRatio,
  hoverRatio,
  durationSeconds
}: {
  readonly edgeRatio: number | undefined
  readonly hoverRatio: number | null
  readonly durationSeconds: number
}) {
  return (
    <>
      {edgeRatio !== undefined && (
        <span
          className={styles.edgeLabel}
          data-testid="loop-edge-label"
          style={{ left: `${clamp01(edgeRatio) * 100}%` }}
          aria-hidden="true"
        >
          {formatTimecode(clamp01(edgeRatio) * durationSeconds)}
        </span>
      )}

      {hoverRatio !== null && (
        <span
          className={styles.hover}
          style={{ left: `${clamp01(hoverRatio) * 100}%` }}
          aria-hidden="true"
        >
          <span className={styles.hoverLabel} data-testid="waveform-hover-label">
            {formatTimecode(clamp01(hoverRatio) * durationSeconds)}
          </span>
        </span>
      )}
    </>
  )
}

/** The detected beat grid as vertical lines, downbeats drawn stronger. */
function BeatLines({
  beatGrid,
  durationSeconds
}: {
  readonly beatGrid: BeatGrid
  readonly durationSeconds: number
}) {
  return beatGrid.map((beat) => (
    <span
      key={beat.timeSeconds}
      className={beat.downbeat ? styles.downbeat : styles.beat}
      style={{
        left: `${clamp01(beat.timeSeconds / durationSeconds) * 100}%`
      }}
      data-beat={beat.downbeat ? 'downbeat' : 'beat'}
      aria-hidden="true"
    />
  ))
}

/** Convert the loop region into start/end fractions, or undefined if not usable. */
function loopRatios(
  region: LoopRegion | undefined,
  durationSeconds: number
): { readonly start: number; readonly end: number } | undefined {
  if (!region || durationSeconds <= 0) {
    return undefined
  }
  return {
    start: clamp01(region.startSeconds / durationSeconds),
    end: clamp01(region.endSeconds / durationSeconds)
  }
}
