import { Trans, useLingui } from '@lingui/react/macro'
import type { LoopRegion } from '@app/core'
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import type { ImportState } from './use-player.ts'
import { WaveformCanvas } from './waveform-canvas.tsx'
import styles from './waveform-view.module.css'

interface WaveformViewProps {
  readonly state: ImportState
  /** The active loop, for the « loupe » dim overlay and the A/B edit handles. */
  readonly loopRegion: LoopRegion | undefined
  /** Whether the region loops: dims outside when on, just outlines it when off. */
  readonly loopEnabled: boolean
  readonly durationSeconds: number
  /** Click (no drag) seeks to a fraction (0–1) of the timeline. */
  readonly onSeek: (ratio: number) => void
  /** A fresh surface drag selects a new (unsaved) A/B region, fractions 0–1. */
  readonly onSelectRegion: (startRatio: number, endRatio: number) => void
  /** Moving a handle (or arrow-nudging it) adjusts the existing region in place. */
  readonly onAdjustRegion: (startRatio: number, endRatio: number) => void
}

// Below this drag distance (fraction of the width) a press counts as a click.
const DRAG_THRESHOLD = 0.005
// Keyboard step for nudging a loop edge with the arrow keys.
const NUDGE_RATIO = 0.01

/** Which loop edge a handle drives. */
type Edge = 'start' | 'end'

/** The in-progress pointer gesture, or null when idle. */
type Drag =
  | { readonly kind: 'select'; readonly anchor: number; readonly current: number }
  | { readonly kind: 'edge'; readonly start: number; readonly end: number }

/**
 * Dumb presentational view of the import state: a prompt while idle, progress
 * while decoding, an alert on failure, and — once loaded — the amber waveform
 * with click-to-seek, drag-to-select (the « loupe »), a live selection preview,
 * draggable A/B edge handles, and a dim overlay outside the active loop. It fills
 * its `ZoomStage` layer, so its 0–1 coordinates are whole-timeline ratios at any
 * zoom; the playhead and scrolling are the stage's.
 */
export function WaveformView({
  state,
  loopRegion,
  loopEnabled,
  durationSeconds,
  onSeek,
  onSelectRegion,
  onAdjustRegion
}: WaveformViewProps) {
  const { t } = useLingui()
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  /** The pointer's position along the surface as a 0–1 ratio, or null. */
  function ratioFrom(clientX: number): number | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) {
      return null
    }
    return clamp01((clientX - rect.left) / rect.width)
  }

  function beginSelect(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) {
      return
    }
    const ratio = ratioFrom(event.clientX)
    if (ratio === null) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ kind: 'select', anchor: ratio, current: ratio })
  }

  function beginEdge(
    event: PointerEvent<HTMLButtonElement>,
    edge: Edge,
    region: { readonly start: number; readonly end: number }
  ): void {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ kind: 'edge', start: region.start, end: region.end })
    moveEdge(edge, event.clientX)
  }

  function moveEdge(edge: Edge, clientX: number): void {
    const ratio = ratioFrom(clientX)
    if (ratio === null) {
      return
    }
    setDrag((current) => {
      if (current?.kind !== 'edge') {
        return current
      }
      return edge === 'start'
        ? { ...current, start: ratio }
        : { ...current, end: ratio }
    })
  }

  function onPointerMove(event: PointerEvent): void {
    const ratio = ratioFrom(event.clientX)
    if (ratio === null) {
      return
    }
    setDrag((current) => {
      if (current?.kind === 'select') {
        return { ...current, current: ratio }
      }
      return current
    })
  }

  function onPointerUp(event: PointerEvent): void {
    const finished = drag
    setDrag(null)
    if (!finished) {
      return
    }
    const ratio = ratioFrom(event.clientX)
    if (finished.kind === 'select') {
      const end = ratio ?? finished.current
      if (Math.abs(end - finished.anchor) < DRAG_THRESHOLD) {
        onSeek(end)
      } else {
        onSelectRegion(Math.min(finished.anchor, end), Math.max(finished.anchor, end))
      }
      return
    }
    onAdjustRegion(
      Math.min(finished.start, finished.end),
      Math.max(finished.start, finished.end)
    )
  }

  function nudgeEdge(
    edge: Edge,
    delta: number,
    region: { readonly start: number; readonly end: number }
  ): void {
    const moved =
      edge === 'start'
        ? { start: clamp01(region.start + delta), end: region.end }
        : { start: region.start, end: clamp01(region.end + delta) }
    onAdjustRegion(Math.min(moved.start, moved.end), Math.max(moved.start, moved.end))
  }

  function onHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    edge: Edge,
    region: { readonly start: number; readonly end: number }
  ): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeEdge(edge, -NUDGE_RATIO, region)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeEdge(edge, NUDGE_RATIO, region)
    }
  }

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
      return (
        <p className={styles.hint}>
          <Trans id="waveform.decoding">Décodage…</Trans>
        </p>
      )
    case 'error':
      return (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )
    case 'loaded': {
      const committed = loopRatios(loopRegion, durationSeconds)
      // The edge drag previews live; otherwise the region/handles follow state.
      const region =
        drag?.kind === 'edge'
          ? { start: Math.min(drag.start, drag.end), end: Math.max(drag.start, drag.end) }
          : committed
      const selection =
        drag?.kind === 'select' &&
        Math.abs(drag.current - drag.anchor) >= DRAG_THRESHOLD
          ? { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) }
          : undefined

      return (
        <div
          ref={containerRef}
          className={styles.container}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <button
            type="button"
            className={styles.surface}
            aria-label={t({
              id: 'waveform.surface',
              message:
                "Forme d'onde : clic pour se positionner, glisser pour boucler"
            })}
            onPointerDown={beginSelect}
          >
            <WaveformCanvas
              waveform={state.track.waveform}
              label={t({
                id: 'waveform.track-image',
                message: "Forme d'onde de la piste"
              })}
            />
          </button>

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
                onPointerDown={(event) => beginEdge(event, 'start', region)}
                onPointerMove={(event) => moveEdge('start', event.clientX)}
                onKeyDown={(event) => onHandleKeyDown(event, 'start', region)}
              />
              <button
                type="button"
                className={styles.handle}
                style={{ left: `${region.end * 100}%` }}
                aria-label={t({
                  id: 'waveform.move-loop-end',
                  message: 'Déplacer la fin de la boucle'
                })}
                onPointerDown={(event) => beginEdge(event, 'end', region)}
                onPointerMove={(event) => moveEdge('end', event.clientX)}
                onKeyDown={(event) => onHandleKeyDown(event, 'end', region)}
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
        </div>
      )
    }
  }
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
