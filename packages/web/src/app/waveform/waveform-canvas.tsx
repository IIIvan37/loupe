import type { Waveform } from '@app/core'
import { useEffect, useRef } from 'react'
import styles from './waveform-canvas.module.css'

interface WaveformCanvasProps {
  readonly waveform: Waveform
  readonly label: string
  /** CSS custom property to paint the envelope with (default the amber accent). */
  readonly colorVar?: string
  /** Paint with the loupe identity — the amber→teal horizontal gradient of
      the centrepiece (AO.1). Absent = a stem lane's own flat colour. */
  readonly identity?: boolean
  /** A decorative copy under an aria-labelled base (the played overlay):
      no img role, hidden from assistive tech — one image for AT, two layers
      for the eyes. */
  readonly decorative?: boolean
}

/**
 * Presentational waveform: paints the peak envelope as a soft halo and the RMS
 * core as the solid body (AO.1 two-tone relief), coloured by the amber→teal
 * horizontal gradient of the loupe identity (or a stem's flat colour). Pure
 * view — peaks in, pixels out; all summarising happened in the core. The
 * imperative draw is the canvas equivalent of returning JSX.
 */
export function WaveformCanvas({
  waveform,
  label,
  colorVar = '--amber',
  identity = false,
  decorative = false
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    paint(canvas, context, waveform, colorVar, identity)
    // Repaint when the canvas resizes — zooming widens it, and so does a window
    // resize — so the bitmap always matches its CSS box rather than stretching.
    const observer = new ResizeObserver(() =>
      paint(canvas, context, waveform, colorVar, identity)
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [waveform, colorVar, identity])

  if (decorative) {
    return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
  }
  return (
    <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
  )
}

/** The alpha the peak halo fades to against the solid RMS core. */
const PEAK_ALPHA = 0.45

/** Resolve a CSS custom property against the canvas, with a fallback. */
function cssColor(canvas: HTMLCanvasElement, name: string, fallback: string) {
  const value = getComputedStyle(canvas).getPropertyValue(name).trim()
  return value || fallback
}

/** What the envelope paints with: the amber→teal horizontal gradient of the
    loupe identity for the centrepiece (both split sides share it — the split
    reads by intensity, not hue), a stem's own flat colour otherwise. */
function envelopeFill(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  colorVar: string,
  identity: boolean
): string | CanvasGradient {
  if (!identity) {
    return cssColor(canvas, colorVar, 'currentColor')
  }
  const sweep = context.createLinearGradient(0, 0, width, 0)
  sweep.addColorStop(0, cssColor(canvas, '--amber', '#e5a53d'))
  sweep.addColorStop(1, cssColor(canvas, '--teal', '#56b8c9'))
  return sweep
}

/** Draw the peaks centred on the mid-line, scaled to the canvas's CSS size. */
function paint(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  waveform: Waveform,
  colorVar: string,
  identity: boolean
): void {
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  context.scale(ratio, ratio)

  context.clearRect(0, 0, width, height)
  const peaks = waveform.peaks
  if (peaks.length === 0) {
    return
  }

  context.fillStyle = envelopeFill(canvas, context, width, colorVar, identity)
  const mid = height / 2
  const barWidth = width / peaks.length
  // One column of the envelope — the bar-geometry floors live here only.
  const fillBar = (index: number, top: number, bottom: number) => {
    context.fillRect(
      index * barWidth,
      top,
      Math.max(barWidth, 1),
      Math.max(bottom - top, 1)
    )
  }
  if (!identity) {
    // A stem lane keeps its flat solid envelope — the two-tone relief is the
    // centrepiece's; layered over the lane-level fade it would starve quiet
    // stems of their silhouette.
    peaks.forEach((peak, index) => {
      fillBar(index, mid - peak.max * mid, mid - peak.min * mid)
    })
    return
  }
  // Pass 1 — the peak envelope as a soft halo around the body.
  context.globalAlpha = PEAK_ALPHA
  peaks.forEach((peak, index) => {
    fillBar(index, mid - peak.max * mid, mid - peak.min * mid)
  })
  // Pass 2 — the RMS core, solid: the loudness the ear actually follows.
  // Each side is bounded by the envelope: an asymmetric bucket (transient,
  // DC offset) must never show a solid core past its actual signal.
  context.globalAlpha = 1
  peaks.forEach((peak, index) => {
    const top = mid - Math.min(peak.rms, peak.max) * mid
    const bottom = mid + Math.min(peak.rms, -peak.min) * mid
    fillBar(index, top, bottom)
  })
}
