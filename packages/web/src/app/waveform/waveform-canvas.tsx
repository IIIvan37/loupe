import type { Waveform } from '@app/core'
import { useEffect, useRef } from 'react'
import styles from './waveform-canvas.module.css'

interface WaveformCanvasProps {
  readonly waveform: Waveform
  readonly label: string
}

/**
 * Presentational waveform: paints min/max peaks as an amber envelope on a
 * canvas. Pure view — peaks in, pixels out; all summarising happened in the
 * core. The imperative draw is the canvas equivalent of returning JSX.
 */
export function WaveformCanvas({ waveform, label }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    paint(canvas, context, waveform)
  }, [waveform])

  return (
    <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
  )
}

/** Draw the peaks centred on the mid-line, scaled to the canvas's CSS size. */
function paint(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  waveform: Waveform
): void {
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  context.scale(ratio, ratio)

  context.clearRect(0, 0, width, height)
  const amber = getComputedStyle(canvas).getPropertyValue('--amber').trim()
  context.fillStyle = amber

  const peaks = waveform.peaks
  if (peaks.length === 0) {
    return
  }
  const mid = height / 2
  const barWidth = width / peaks.length
  peaks.forEach((peak, index) => {
    const top = mid - peak.max * mid
    const bottom = mid - peak.min * mid
    context.fillRect(index * barWidth, top, Math.max(barWidth, 1), Math.max(bottom - top, 1))
  })
}
