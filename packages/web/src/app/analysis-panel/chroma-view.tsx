import { chromaFromSpectrum, type SpectrumFrame } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
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
  /** One read of the audible output's spectrum (undefined = no tap yet). */
  readonly readSpectrum: () => SpectrumFrame | undefined
  readonly playing: boolean
}

/**
 * The Spectre tab's « peaks = candidate notes » read-out: the playing signal's
 * energy folded onto the 12 pitch classes, one bar per class. Polls the
 * engine's analyser tap while playing — the samples stay inside this leaf, so
 * the 10 Hz refresh never re-renders the shell above it.
 */
export function ChromaView({ readSpectrum, playing }: ChromaViewProps) {
  const { t } = useLingui()
  const [chroma, setChroma] = useState<readonly number[]>()
  const latestRead = useLatest(readSpectrum)
  useEffect(() => {
    if (!playing) {
      return
    }
    const timer = setInterval(() => {
      const frame = latestRead.current()
      if (frame) {
        setChroma(chromaFromSpectrum(frame.magnitudes, frame.sampleRate))
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [playing, latestRead])
  if (!playing && chroma === undefined) {
    return (
      <p className={styles.idle}>
        {t({
          id: 'analysis.chroma-idle',
          message: 'Lancer la lecture pour voir les notes dominantes.'
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
        message: 'Notes dominantes du signal en cours de lecture'
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
