import {
  type LoopLibrary,
  type MarkerList,
  type MixerChannel,
  type MixerState,
  type ProjectActiveLoop,
  type ProjectTuning,
  tuningOrDefault
} from '@app/core'
import { DEFAULT_METRONOME_CHANNEL } from '../app/tempo/metronome-stem.ts'

/** The light, persisted parts of a session — both a live session and a saved
 * `Project` narrow to this shape, so the two sides sign identically. */
export interface SignedSession {
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  readonly activeLoop?: ProjectActiveLoop | undefined
  readonly tuning?: ProjectTuning | undefined
  /** The metronome's mixer settings plus the manual octave correction — the only
   * user-editable tempo state. The beat grid and BPM are derived from detection
   * and the fold, so they stay out of the signature (the octave shift stands in
   * for the fold). */
  readonly tempo?:
    | { readonly metronome: MixerChannel; readonly octaveShift?: number }
    | undefined
  readonly separation?: { readonly mixer: MixerState } | undefined
}

/**
 * A canonical fingerprint of what a save would persist (minus the heavy
 * audio, which only changes with a new import or separation). Equal
 * signatures ⇔ the saved project already holds this session — the basis of
 * the « Enregistré / Non enregistré » read-out. Fields are re-projected
 * explicitly so extra properties and key order can never skew the comparison.
 */
export function sessionSignature(session: SignedSession): string {
  // Absent tuning (a manifest that predates the field) reads as neutral, so
  // an untouched reopened old project still signs « Enregistré ».
  const tuning = tuningOrDefault(session.tuning)
  // No metronome yet ⇔ a fresh detection would seat the default-muted one, so
  // the two must sign the same or a reopened old project would read dirty.
  const metronome = session.tempo?.metronome ?? DEFAULT_METRONOME_CHANNEL
  // Absent octave shift (a manifest that predates the toggle, or an untouched
  // detection) reads as neutral 0, so a reopened old project still signs equal.
  const octaveShift = session.tempo?.octaveShift ?? 0
  return JSON.stringify({
    loops: session.loops.map((loop) => [
      loop.id,
      loop.name,
      loop.region.startSeconds,
      loop.region.endSeconds
    ]),
    markers: session.markers.map((marker) => [
      marker.id,
      marker.timeSeconds,
      marker.label
    ]),
    activeLoop: session.activeLoop
      ? [
          session.activeLoop.region.startSeconds,
          session.activeLoop.region.endSeconds,
          session.activeLoop.enabled
        ]
      : null,
    tuning: [tuning.timeRatio, tuning.pitchSemitones, tuning.zoom],
    metronome: [metronome.gainDb, metronome.muted, metronome.soloed],
    octaveShift,
    mixer: session.separation
      ? session.separation.mixer.map((channel) => [
          channel.id,
          channel.gainDb,
          channel.muted,
          channel.soloed
        ])
      : null
  })
}
