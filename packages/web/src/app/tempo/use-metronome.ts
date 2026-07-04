import type {
  BeatGrid,
  DecodedAudio,
  SeparatedStem,
  StemTrack
} from '@app/core'
import { useRef, useState } from 'react'
import { buildTrackStem } from '../mixer/track-stem.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import { buildMetronomeStem } from './metronome-stem.ts'

export interface MetronomeDeps {
  readonly mixer: Mixer
  /** The loaded PCM (sample rate + length source), undefined before import. */
  readonly loadedAudio: DecodedAudio | undefined
  readonly durationSeconds: number
}

export interface Metronome {
  readonly enabled: boolean
  /**
   * Seat the click on an un-separated track: it joins the whole track (brought
   * in as a « Piste » stem) so the click has something to play against. Called
   * from the auto-detection handler.
   */
  readonly enable: (grid: BeatGrid) => void
  /**
   * Seat the click alongside a fresh separation, loading the stems and the click
   * together in one pass (so the separated stems are never overwritten). Called
   * from the separation handler.
   */
  readonly attach: (
    grid: BeatGrid,
    stems: readonly StemTrack[],
    sources: readonly SeparatedStem[]
  ) => void
  /** Forget the click (a fresh track); the shell clears the mixer separately. */
  readonly reset: () => void
}

/**
 * Smart hook: the metronome as a mixer stem. Once the tempo is known the click
 * is always shown — the shell seats it from the detection handler (`enable`,
 * un-separated) or the separation handler (`attach`, joining the stems). Each
 * path does a single `mixer.load` so nothing it just loaded gets overwritten.
 * It then behaves like any other stem (fader, mute/solo, lane, WAV) and follows
 * tempo on the shared master bus. Deps are read through a ref so the seating
 * calls, fired from async handlers, always see the live audio.
 */
export function useMetronome(deps: MetronomeDeps): Metronome {
  const depsRef = useRef(deps)
  depsRef.current = deps
  const [enabled, setEnabled] = useState(false)

  function enable(grid: BeatGrid): void {
    const live = depsRef.current
    if (!live.loadedAudio) {
      return
    }
    const metro = buildMetronomeStem(
      grid,
      live.durationSeconds,
      live.loadedAudio.sampleRate
    )
    // The click needs the track itself in the mix, so bring the whole track in
    // as one stem and seat the click beside it.
    const track = buildTrackStem(live.loadedAudio)
    live.mixer.load([track.stem, metro.stem], [track.source, metro.source])
    setEnabled(true)
  }

  function attach(
    grid: BeatGrid,
    stems: readonly StemTrack[],
    sources: readonly SeparatedStem[]
  ): void {
    const live = depsRef.current
    if (!live.loadedAudio) {
      return
    }
    const metro = buildMetronomeStem(
      grid,
      live.durationSeconds,
      live.loadedAudio.sampleRate
    )
    // Load the separation stems AND the click in one pass — a two-step load then
    // add would let the freshly loaded stems be clobbered by a stale render.
    live.mixer.load([...stems, metro.stem], [...sources, metro.source])
    setEnabled(true)
  }

  return { enabled, enable, attach, reset: () => setEnabled(false) }
}
