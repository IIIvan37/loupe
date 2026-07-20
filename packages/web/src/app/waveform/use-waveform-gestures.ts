import { type BeatGrid, nudgeSeconds } from '@app/core'
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { clamp01 } from '../../lib/clamp01.ts'
import { pointerRatio } from '../../lib/pointer-ratio.ts'

// Below this drag distance (fraction of the width) a press counts as a click.
const DRAG_THRESHOLD = 0.005

/** Which loop edge a handle drives. */
export type Edge = 'start' | 'end'

/** A start/end pair as 0–1 ratios of the whole timeline. */
type EdgePair = { readonly start: number; readonly end: number }

/** The in-progress pointer gesture, or null when idle. */
export type Drag =
  | {
      readonly kind: 'select'
      readonly anchor: number
      readonly current: number
    }
  | {
      readonly kind: 'edge'
      readonly edge: Edge
      readonly start: number
      readonly end: number
    }

interface GestureCallbacks {
  readonly durationSeconds: number
  readonly beatGrid: BeatGrid
  readonly onSeek: (ratio: number) => void
  readonly onSelectRegion: (start: number, end: number, snap: boolean) => void
  readonly onAdjustRegion: (start: number, end: number, snap: boolean) => void
}

/**
 * The pointer/keyboard gesture state for the waveform surface: drag-to-select
 * the « loupe », drag or arrow-nudge the A/B edge handles, and the idle hover
 * cursor. Keeps `WaveformView` a thin presentational shell — it reads the state
 * and wires these handlers onto the surface, container and handles.
 *
 * All coordinates are 0–1 ratios of the whole timeline, measured against the
 * container the surface fills, so they stay zoom-agnostic.
 */
export function useWaveformGestures({
  durationSeconds,
  beatGrid,
  onSeek,
  onSelectRegion,
  onAdjustRegion
}: GestureCallbacks) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // The edge whose handle holds keyboard focus — floats its timecode so an
  // arrow-key nudge reads out where it lands. Cleared on blur.
  const [focusedEdge, setFocusedEdge] = useState<Edge | null>(null)
  // The pointer's position over the surface while idle — a hover cursor line
  // with a timecode. Suppressed during any drag; cleared when the pointer leaves.
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)

  /** The pointer's position along the surface as a 0–1 ratio, or null. */
  function ratioFrom(clientX: number): number | null {
    return pointerRatio(containerRef.current?.getBoundingClientRect(), clientX)
  }

  function beginSelect(event: PointerEvent<HTMLDivElement>): void {
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
    region: EdgePair
  ): void {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setHoverRatio(null)
    setDrag({ kind: 'edge', edge, start: region.start, end: region.end })
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
    // Idle move → the hover marker follows the pointer; mid-gesture it steps
    // aside so it never fights the selection preview or an edge label.
    setHoverRatio(drag === null ? ratio : null)
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
    const snap = !event.altKey
    if (finished.kind === 'select') {
      const end = ratio ?? finished.current
      if (Math.abs(end - finished.anchor) < DRAG_THRESHOLD) {
        onSeek(end)
      } else {
        onSelectRegion(
          Math.min(finished.anchor, end),
          Math.max(finished.anchor, end),
          snap
        )
      }
      return
    }
    onAdjustRegion(
      Math.min(finished.start, finished.end),
      Math.max(finished.start, finished.end),
      snap
    )
  }

  function nudgeEdge(
    edge: Edge,
    direction: -1 | 1,
    coarse: boolean,
    region: EdgePair
  ): void {
    // Musical units: the adjacent beat (bar with Shift) when a grid exists,
    // 0.1 s (×10 with Shift) otherwise — see `nudgeSeconds`.
    const nudge = (ratio: number) =>
      clamp01(
        nudgeSeconds(ratio * durationSeconds, direction, beatGrid, coarse) /
          durationSeconds
      )
    const moved =
      edge === 'start'
        ? { start: nudge(region.start), end: region.end }
        : { start: region.start, end: nudge(region.end) }
    // An arrow nudge lands on the unit itself — never re-snapped.
    onAdjustRegion(
      Math.min(moved.start, moved.end),
      Math.max(moved.start, moved.end),
      false
    )
  }

  function onHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    edge: Edge,
    region: EdgePair
  ): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeEdge(edge, -1, event.shiftKey, region)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeEdge(edge, 1, event.shiftKey, region)
    }
  }

  return {
    containerRef,
    drag,
    focusedEdge,
    hoverRatio,
    beginSelect,
    beginEdge,
    moveEdge,
    onPointerMove,
    onPointerUp,
    onHandleKeyDown,
    clearHover: () => setHoverRatio(null),
    focusEdge: (edge: Edge) => setFocusedEdge(edge),
    blurEdge: () => setFocusedEdge(null)
  }
}

/** The 0–1 ratio a select drag would commit to, or null below the click threshold. */
export function selectionPair(drag: Drag | null): EdgePair | undefined {
  if (
    drag?.kind !== 'select' ||
    Math.abs(drag.current - drag.anchor) < DRAG_THRESHOLD
  ) {
    return undefined
  }
  return {
    start: Math.min(drag.anchor, drag.current),
    end: Math.max(drag.anchor, drag.current)
  }
}

/** The live region an edge drag previews (normalised), or undefined when idle. */
export function draggingPair(drag: Drag | null): EdgePair | undefined {
  if (drag?.kind !== 'edge') {
    return undefined
  }
  return {
    start: Math.min(drag.start, drag.end),
    end: Math.max(drag.start, drag.end)
  }
}

/**
 * The 0–1 ratio of the loop edge whose timecode should float: the edge being
 * dragged (its live, pre-normalisation value) or the one holding keyboard focus
 * (its committed value). Undefined when no edge is active.
 */
export function floatingEdgeRatio(
  drag: Drag | null,
  focusedEdge: Edge | null,
  committed: EdgePair | undefined
): number | undefined {
  if (drag?.kind === 'edge') {
    return drag.edge === 'start' ? drag.start : drag.end
  }
  if (focusedEdge && committed) {
    return committed[focusedEdge]
  }
  return undefined
}
