import type { Waveform } from '@app/core'
import { useEffect, useRef } from 'react'
import styles from './waveform-canvas.module.css'

/** The colour split's two sides (AO.1): vivid for what has PLAYED, muted for
    what is to come. Absent = a stem lane painting with its own colour. */
type WaveformTone = 'played' | 'upcoming'

interface WaveformCanvasProps {
  readonly waveform: Waveform
  readonly label: string
  /** CSS custom property to paint the envelope with (default the amber accent). */
  readonly colorVar?: string
  readonly tone?: WaveformTone | undefined
  /** A decorative copy under an aria-labelled base (the played overlay):
      no img role, hidden from assistive tech — one image for AT, two layers
      for the eyes. */
  readonly decorative?: boolean
}

/**
 * Presentational waveform: paints the peak envelope as a soft halo and the RMS
 * core as the vivid body (AO.1 two-tone relief), on a vertical gradient so the
 * tips fade out — plus, on the played side, the amber→teal sweep of the loupe
 * identity. Pure view — peaks in, pixels out; all summarising happened in the
 * core. The imperative draw is the canvas equivalent of returning JSX.
 */
export function WaveformCanvas({
  waveform,
  label,
  colorVar = '--amber',
  tone,
  decorative = false
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    paint(canvas, context, waveform, colorVar, tone)
    // Repaint when the canvas resizes — zooming widens it, and so does a window
    // resize — so the bitmap always matches its CSS box rather than stretching.
    const observer = new ResizeObserver(() =>
      paint(canvas, context, waveform, colorVar, tone)
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [waveform, colorVar, tone])

  if (decorative) {
    return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
  }
  return (
    <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
  )
}

/** The alpha the peak halo fades to against the solid RMS core. */
const PEAK_ALPHA = 0.45
/** The strength of the amber→teal identity sweep over the played side. */
const SWEEP_ALPHA = 0.4

/** Resolve a CSS custom property against the canvas, with a fallback. */
function cssColor(canvas: HTMLCanvasElement, name: string, fallback: string) {
  const value = getComputedStyle(canvas).getPropertyValue(name).trim()
  return value || fallback
}

/** The bright / deep pair a tone paints with (deep at the fading tips). */
function tonePalette(
  canvas: HTMLCanvasElement,
  colorVar: string,
  tone: WaveformTone | undefined
): { bright: string; deep: string } {
  if (tone === 'played') {
    return {
      bright: cssColor(canvas, '--amber', '#e5a53d'),
      deep: cssColor(canvas, '--amber-deep', '#b07d23')
    }
  }
  if (tone === 'upcoming') {
    return {
      bright: cssColor(canvas, '--dim', '#8b90a3'),
      deep: cssColor(canvas, '--line-strong', '#3a3f52')
    }
  }
  const color = cssColor(canvas, colorVar, 'currentColor')
  return { bright: color, deep: color }
}

/** Draw the peaks centred on the mid-line, scaled to the canvas's CSS size. */
function paint(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  waveform: Waveform,
  colorVar: string,
  tone: WaveformTone | undefined
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

  // Vertical amplitude gradient: the mid-line bright, the tips deep — every
  // column samples its own slice, so tall peaks fade out on their own.
  const { bright, deep } = tonePalette(canvas, colorVar, tone)
  const vertical = context.createLinearGradient(0, 0, 0, height)
  vertical.addColorStop(0, deep)
  vertical.addColorStop(0.5, bright)
  vertical.addColorStop(1, deep)
  context.fillStyle = vertical

  const mid = height / 2
  const barWidth = width / peaks.length
  // Pass 1 — the peak envelope as a soft halo around the body.
  context.globalAlpha = PEAK_ALPHA
  peaks.forEach((peak, index) => {
    const top = mid - peak.max * mid
    const bottom = mid - peak.min * mid
    context.fillRect(
      index * barWidth,
      top,
      Math.max(barWidth, 1),
      Math.max(bottom - top, 1)
    )
  })
  // Pass 2 — the RMS core, solid: the loudness the ear actually follows.
  context.globalAlpha = 1
  peaks.forEach((peak, index) => {
    const half = peak.rms * mid
    context.fillRect(
      index * barWidth,
      mid - half,
      Math.max(barWidth, 1),
      Math.max(half * 2, 1)
    )
  })

  if (tone === 'played') {
    // The loupe identity: a subtle amber→teal hue sweep across time, laid
    // only over the pixels already painted (source-atop keeps the silhouette).
    const sweep = context.createLinearGradient(0, 0, width, 0)
    sweep.addColorStop(0, cssColor(canvas, '--amber', '#e5a53d'))
    sweep.addColorStop(1, cssColor(canvas, '--teal', '#56b8c9'))
    context.globalCompositeOperation = 'source-atop'
    context.globalAlpha = SWEEP_ALPHA
    context.fillStyle = sweep
    context.fillRect(0, 0, width, height)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
  }
}
