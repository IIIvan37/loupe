import {
  type BeatGrid,
  chartTransposedBy,
  DEFAULT_BEATS_PER_BAR,
  type LoopLibrary,
  type ManualTempo,
  type MarkerList,
  type MixerChannel,
  type MixerState,
  type ProjectActiveLoop,
  type ProjectChordChart,
  type ProjectTuning,
  sanitizeBeatGrid,
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
  /** The metronome's mixer settings plus the user-editable tempo state: the
   * manual octave correction and the manual override (typed/tapped/aligned
   * bpm + phase). The beat grid and BPM are derived from detection, the fold
   * and the override, so they stay out of the signature (the shift and the
   * override stand in for them). */
  readonly tempo?:
    | {
        readonly metronome: MixerChannel
        readonly octaveShift?: number
        readonly manual?: ManualTempo | undefined
        /** The bar length behind the grid — detected, or the user's meter
         * correction. Signed so a correction reads as an unsaved edit;
         * absent ⇔ common time on manifests that predate it. */
        readonly beatsPerBar?: number | undefined
        /** The beat grid itself: its DOWNBEAT PATTERN is signed (a meter
         * correction rewrites it — same beatsPerBar, different bars — and
         * must still read as an unsaved edit). */
        readonly grid?: BeatGrid | undefined
      }
    | undefined
  /** The chord chart source text; absent ⇔ the user has typed none. */
  readonly chordChart?: ProjectChordChart | undefined
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
  // Absent manual override (a manifest that predates it, or an untouched
  // detection) reads as null, so a reopened old project still signs equal.
  const manual = session.tempo?.manual
  // Absent meter (a manifest that predates it) reads as common time, the same
  // default the restore path seats — a reopened old project signs equal.
  const beatsPerBar = session.tempo?.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
  // The downbeat pattern as beat indices, over the SANITIZED grid — the
  // restore path re-seats a sanitized grid, so both sides must sign the
  // grid the same way or a reopened old project would read dirty.
  const grid = session.tempo?.grid
  const downbeats =
    grid === undefined
      ? null
      : sanitizeBeatGrid(grid).flatMap((beat, index) =>
          beat.downbeat ? [index] : []
        )
  // Absent chart (a manifest that predates it) reads like an empty one, so a
  // reopened old project still signs « Enregistré » with the empty textarea.
  const chordChart = session.chordChart?.source ?? ''
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
      marker.label,
      marker.kind
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
    manualTempo: manual ? [manual.bpm, manual.phaseSeconds] : null,
    beatsPerBar,
    downbeats,
    chordChart: chordChart === '' ? null : chordChart,
    // Absent chart or pre-offset manifest reads as untransposed 0, so a
    // reopened old project still signs equal.
    chartTransposedBy: chartTransposedBy(session.chordChart),
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
