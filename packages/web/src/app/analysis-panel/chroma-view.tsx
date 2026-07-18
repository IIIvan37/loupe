import { chromaFromSpectrum, type SpectrumFrame } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import type { ExternalValue } from '../../lib/external-value.ts'
import { useLatest } from '../../lib/use-latest.ts'
import styles from './chroma-view.module.css'

/** Display order C … B; unicode accidentals match the chart's spelling. */
const PITCH_CLASSES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B'
] as const

/** ~10 Hz: fast enough to follow the music, far below any render budget. */
const POLL_MS = 100

interface ChromaViewProps {
  /** One read of the signal's spectrum: the analyser tap while playing, the
   * decoded buffer at the playhead at rest (undefined = no track at all). */
  readonly readSpectrum: () => SpectrumFrame | undefined
  readonly playing: boolean
  /** The playhead stream — drives paused refreshes (seek, measure click). */
  readonly position: ExternalValue<number>
}

/**
 * The Spectre tab's « peaks = candidate notes » read-out: the signal's energy
 * folded onto the 12 pitch classes, one bar per class. Polls the engine's
 * analyser tap while playing; at rest it reads once and then only on position
 * changes — paused navigation keeps the notes in view. The samples stay
 * inside this leaf, so no refresh re-renders the shell above it.
 */
export function ChromaView({ readSpectrum, playing, position }: ChromaViewProps) {
  const { t } = useLingui()
  const [chroma, setChroma] = useState<readonly number[]>()
  const latestRead = useLatest(readSpectrum)
  useEffect(() => {
    const read = () => {
      const frame = latestRead.current()
      if (frame) {
        setChroma(chromaFromSpectrum(frame.magnitudes, frame.sampleRate))
      }
    }
    if (playing) {
      const timer = setInterval(read, POLL_MS)
      return () => clearInterval(timer)
    }
    // At rest: one read on the next tick (the tap went silent, the buffer
    // serves the playhead window — deferred so the effect never sets state
    // synchronously), then one per seek.
    const initial = setTimeout(read, 0)
    const unsubscribe = position.subscribe(read)
    return () => {
      clearTimeout(initial)
      unsubscribe()
    }
  }, [playing, position, latestRead])
  if (!playing && chroma === undefined) {
    return (
      <p className={styles.idle}>
        {t({
          id: 'analysis.chroma-idle',
          message: 'Importer une piste pour voir les notes dominantes.'
        })}
      </p>
    )
  }
  return (
    <div
      className={styles.chart}
      role="img"
      aria-label={t({
        id: 'analysis.chroma-label',
        message: 'Notes dominantes à la position de lecture'
      })}
    >
      {PITCH_CLASSES.map((name, pitchClass) => (
        <div key={name} className={styles.column}>
          <div className={styles.well}>
            <div
              className={styles.bar}
              data-testid={`chroma-bar-${name}`}
              style={{ blockSize: `${(chroma?.[pitchClass] ?? 0) * 100}%` }}
            />
          </div>
          <span className={styles.note}>{name}</span>
        </div>
      ))}
    </div>
  )
}
