import type {
  BeatGrid,
  DecodedAudio,
  MixerChannel,
  MixerState,
  SeparatedStem,
  StemTrack
} from '@app/core'
import { UNITY_GAIN_DB } from '@app/core'
import { useRef, useState } from 'react'
import { buildTrackStem, TRACK_STEM_ID } from '../mixer/track-stem.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import { buildMetronomeStem, METRONOME_ID } from './metronome-stem.ts'

export interface MetronomeDeps {
  readonly mixer: Mixer
}

export interface Metronome {
  readonly enabled: boolean
  /**
   * Seat the click on an un-separated track: it joins the whole track (brought
   * in as a « Piste » stem) so the click has something to play against. The
   * click channel carries explicit settings — muted by default on a fresh
   * detection, or the saved settings when restoring a project.
   */
  readonly enable: (
    grid: BeatGrid,
    audio: DecodedAudio,
    metronome: MixerChannel
  ) => void
  /**
   * Seat the click alongside a separation, loading the stems and the click
   * together in one pass (so the separated stems are never overwritten). The
   * base channels are the stems' own settings (unity for a fresh separation, the
   * saved mixer when restoring); the click carries its settings on top.
   */
  readonly attach: (
    grid: BeatGrid,
    stems: readonly StemTrack[],
    sources: readonly SeparatedStem[],
    audio: DecodedAudio,
    baseMixer: MixerState,
    metronome: MixerChannel
  ) => void
  /**
   * Re-render the click for a folded beat grid (an octave ×2/÷2) and swap it into
   * the running mix, leaving its channel — and every other stem — untouched.
   */
  readonly reseat: (grid: BeatGrid, audio: DecodedAudio) => void
  /**
   * Make the click audible / silence it — a mute toggle on its channel, the
   * same switch as the lane's mute button. A no-op while no click is seated.
   */
  readonly toggle: () => void
  /** Forget the click (a fresh track); the shell clears the mixer separately. */
  readonly reset: () => void
}

/** Whole-track length in seconds from the decoded PCM (the click spans it). */
function durationOf(audio: DecodedAudio): number {
  return (audio.channels[0]?.length ?? 0) / audio.sampleRate
}

/** A stem that plays untouched at its separated level. */
function unityChannel(id: string): MixerChannel {
  return { id, gainDb: UNITY_GAIN_DB, muted: false, soloed: false }
}

/**
 * Smart hook: the metronome as a mixer stem. Once the tempo is known the click
 * is always shown — the shell seats it from the detection handler (`enable`,
 * un-separated) or the separation handler (`attach`, joining the stems). Each
 * path does a single `mixer.restore` with explicit per-channel settings, so the
 * click lands at exactly the level/mute it should (muted by default, or the
 * restored value) without a second dispatch that could race the load. It then
 * behaves like any other stem (fader, mute/solo, lane, WAV) and follows tempo on
 * the shared master bus. The mixer is read through a ref so the seating calls,
 * fired from async handlers, always drive the live one.
 */
export function useMetronome(deps: MetronomeDeps): Metronome {
  const mixerRef = useRef(deps.mixer)
  mixerRef.current = deps.mixer
  const [enabled, setEnabled] = useState(false)

  function enable(
    grid: BeatGrid,
    audio: DecodedAudio,
    metronome: MixerChannel
  ): void {
    const metro = buildMetronomeStem(grid, durationOf(audio), audio.sampleRate)
    // The click needs the track itself in the mix, so bring the whole track in
    // as one stem and seat the click beside it.
    const track = buildTrackStem(audio)
    mixerRef.current.restore(
      [track.stem, metro.stem],
      [track.source, metro.source],
      [unityChannel(TRACK_STEM_ID), metronome]
    )
    setEnabled(true)
  }

  function attach(
    grid: BeatGrid,
    stems: readonly StemTrack[],
    sources: readonly SeparatedStem[],
    audio: DecodedAudio,
    baseMixer: MixerState,
    metronome: MixerChannel
  ): void {
    const metro = buildMetronomeStem(grid, durationOf(audio), audio.sampleRate)
    // Load the separation stems AND the click in one pass — a two-step load then
    // add would let the freshly loaded stems be clobbered by a stale render.
    mixerRef.current.restore(
      [...stems, metro.stem],
      [...sources, metro.source],
      [...baseMixer, metronome]
    )
    setEnabled(true)
  }

  function reseat(grid: BeatGrid, audio: DecodedAudio): void {
    const metro = buildMetronomeStem(grid, durationOf(audio), audio.sampleRate)
    mixerRef.current.replaceStem(metro.stem, metro.source)
  }

  function toggle(): void {
    if (!enabled) {
      return
    }
    mixerRef.current.toggleMute(METRONOME_ID)
  }

  return {
    enabled,
    enable,
    attach,
    reseat,
    toggle,
    reset: () => setEnabled(false)
  }
}
