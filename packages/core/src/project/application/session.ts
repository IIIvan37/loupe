import { decodeWav } from '../../audio/domain/wav-decoder.ts'
import { encodeWav } from '../../audio/domain/wav-encoder.ts'
import type { LoopLibrary } from '../../loops/domain/loop-library.ts'
import type { MarkerList } from '../../markers/domain/marker-list.ts'
import type { TempoAnalysis } from '../../rhythm/application/detect-tempo.ts'
import {
  type BeatGrid,
  DEFAULT_BEATS_PER_BAR
} from '../../rhythm/domain/beat-grid.ts'
import type { ManualTempo } from '../../rhythm/domain/manual-tempo.ts'
import { sanitizeBeatGrid } from '../../rhythm/domain/tempo-map.ts'
import type { SeparatedStem } from '../../separation/application/ports.ts'
import type { MixerChannel, MixerState } from '../../separation/domain/mixer.ts'
import type { StemSet } from '../../separation/domain/stem-set.ts'
import type { DecodedAudio } from '../../shared/decoded-audio.ts'
import {
  type ProjectActiveLoop,
  type ProjectChordChart,
  type ProjectTempo,
  type ProjectTuning,
  tuningOrDefault
} from '../domain/project.ts'
import type { OpenProjectResult, SaveProjectInput } from './projects.ts'

/** The live session pieces a save snapshots. Distinct from `SessionSnapshot`
 * (the assembled project material): this is the raw session — original bytes,
 * PCM-carrying stems — BEFORE the save re-encodes and stores it. */
export interface LiveSessionSnapshot {
  /** The imported file's original encoded bytes. */
  readonly bytes: ArrayBuffer
  readonly title: string | undefined
  readonly artist: string | undefined
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  /** The armed A/B region — the loupe — when one is set. */
  readonly activeLoop?: ProjectActiveLoop
  /** The playback tuning (tempo/pitch/zoom) — always live, always saved. */
  readonly tuning: ProjectTuning
  /** The detected tempo + metronome settings, once a tempo is known. */
  readonly tempo?: ProjectTempo
  /** The chord chart source text, once the user has typed one. */
  readonly chordChart?: ProjectChordChart
  /** The separation half, only once the stems are ready and mixing. */
  readonly separation?: {
    readonly sources: readonly SeparatedStem[]
    readonly mixer: MixerState
  }
}

/**
 * Turn the live session into a save input: the source bytes plus, when stems
 * are mixing, each mixed stem re-encoded as WAV bytes. Persists exactly the
 * stems the mixer mixes — the pair must match (the save use-case enforces the
 * invariant).
 */
export function sessionSaveInput(
  session: LiveSessionSnapshot
): Omit<SaveProjectInput, 'stamp'> {
  const separation = session.separation
  return {
    source: {
      title: session.title,
      artist: session.artist,
      bytes: session.bytes
    },
    loops: session.loops,
    markers: session.markers,
    tuning: session.tuning,
    ...(session.tempo === undefined ? {} : { tempo: session.tempo }),
    ...(session.chordChart === undefined
      ? {}
      : { chordChart: session.chordChart }),
    ...(session.activeLoop === undefined
      ? {}
      : { activeLoop: session.activeLoop }),
    ...(separation === undefined
      ? {}
      : {
          separation: {
            stems: mixedStems(separation.sources, separation.mixer),
            mixer: separation.mixer
          }
        })
  }
}

/** Re-encode the stems the mixer holds a channel for, in one pass. */
function mixedStems(
  sources: readonly SeparatedStem[],
  mixer: MixerState
): NonNullable<SaveProjectInput['separation']>['stems'] {
  const channelIds = new Set(mixer.map((channel) => channel.id))
  return sources.flatMap((source) =>
    channelIds.has(source.id)
      ? [
          {
            id: source.id,
            label: source.label,
            bytes: encodeWav(source.audio.channels, source.audio.sampleRate)
              .buffer as ArrayBuffer
          }
        ]
      : []
  )
}

/** A rebuilt separation: render-ready stems plus their PCM sources. */
export interface RestoredSeparation {
  readonly stems: StemSet
  readonly sources: readonly SeparatedStem[]
}

/**
 * The session surfaces an open rebuilds, after the shell wiped the slate —
 * driven ports in core vocabulary; the adapter maps them onto its live hooks.
 */
export interface SessionRestoreDeps {
  /**
   * Re-import the stored source bytes through the adapter's decode path.
   * Resolves `undefined` when the import failed or a newer user import
   * superseded the restore.
   */
  readonly importAudio: (
    bytes: ArrayBuffer,
    name: string
  ) => Promise<DecodedAudio | undefined>
  /** Seat the persisted markers. The adapter may first re-adopt structure
   * kinds on a pre-kinds manifest (its section vocabulary is display copy). */
  readonly markers: { readonly restore: (markers: MarkerList) => void }
  readonly loops: { readonly restore: (loops: LoopLibrary) => void }
  /**
   * Re-arm the persisted loupe: seat the region with its wrap choice, relinked
   * to the saved loop it came from (`null` for a never-saved region).
   */
  readonly restoreActiveLoop: (
    active: ProjectActiveLoop,
    savedLoopId: string | null
  ) => void
  /** Seat the persisted tuning (tempo/pitch/zoom) on the live controls. */
  readonly restoreTuning: (tuning: ProjectTuning) => void
  /** Seat the persisted chart (text + key offset) — absent reads as empty. */
  readonly restoreChordChart: (chart: ProjectChordChart | undefined) => void
  /** Replay the separation pipeline over decoded stem PCM; `undefined` when
   * the rebuild failed or a newer action superseded it. */
  readonly separation: {
    readonly restore: (
      audio: DecodedAudio,
      sources: readonly SeparatedStem[]
    ) => Promise<RestoredSeparation | undefined>
  }
  /** Seat a rebuilt separation with its persisted mixer settings. */
  readonly mixer: {
    readonly restore: (
      stems: StemSet,
      sources: readonly SeparatedStem[],
      mixer: MixerState
    ) => void
  }
  /** Seat/analyse the tempo (persisted → `set`, old manifest → `detect`). */
  readonly tempo: {
    readonly set: (
      analysis: TempoAnalysis,
      octaveShift: number,
      manual: ManualTempo | undefined
    ) => void
    readonly detect: (audio: DecodedAudio) => Promise<TempoAnalysis | undefined>
  }
  /**
   * Seat the metronome click alongside the restored session. `metronome` is
   * the persisted channel, or `undefined` when the manifest predates it — the
   * adapter then seats its own default-muted click (the channel id is the
   * mixer adapter's business, never the core's).
   */
  readonly metronome: {
    readonly enable: (
      grid: BeatGrid,
      audio: DecodedAudio,
      metronome: MixerChannel | undefined
    ) => void
    readonly attach: (
      grid: BeatGrid,
      stems: StemSet,
      sources: readonly SeparatedStem[],
      audio: DecodedAudio,
      mixer: MixerState,
      metronome: MixerChannel | undefined
    ) => void
  }
  /**
   * Arm/disarm the shell's one-shot auto-detect guard: `true` before an open
   * re-imports its bytes (the open owns tempo/metronome seating), `false` on a
   * fresh user import (which must detect). See the shell's auto-detect effect.
   */
  readonly setSuppressAutoDetect: (suppress: boolean) => void
  /**
   * Narrate the restore's stem-decode steps (« Piste n/total ») — awaited
   * before each stored stem's synchronous WAV decode, so the adapter can both
   * update its chip AND let it paint instead of freezing silent (AS.4).
   */
  readonly onRestoreStep?: (step: {
    readonly stem: number
    readonly total: number
  }) => Promise<void> | void
}

/**
 * Rebuild the working session from an opened project: re-import the stored
 * bytes, restore markers and loops, then — when the project holds a separation
 * — decode each stored stem WAV back to PCM, replay the separation pipeline
 * over it and seat the persisted mixer on the result.
 */
export async function restoreSession(
  opened: Extract<OpenProjectResult, { ok: true }>,
  deps: SessionRestoreDeps
): Promise<void> {
  // The open owns tempo + metronome seating: suppress the shell's auto-detect
  // so it does not also fire on the re-imported audio and race this restore.
  deps.setSuppressAutoDetect(true)
  const audio = await deps.importAudio(opened.sourceBytes, opened.project.name)
  // No audio means the re-import was superseded by a newer user import (or
  // failed): the session belongs to that newer track now — restoring the old
  // project's loops/markers onto it would corrupt what a later save persists.
  // Disarm the guard so that newer track still auto-detects (it owns the flag).
  if (!audio) {
    deps.setSuppressAutoDetect(false)
    return
  }
  deps.markers.restore(opened.project.markers)
  deps.loops.restore(opened.project.loops)
  // A manifest that predates the tuning field means neutral settings — seat
  // them too, so the previous session's tempo/pitch never bleeds in.
  deps.restoreTuning(tuningOrDefault(opened.project.tuning))
  // Same rule for the chart: absent reads as empty, never as « keep whatever
  // the previous session typed ».
  deps.restoreChordChart(opened.project.chordChart)
  const active = opened.project.activeLoop
  if (active) {
    // If the region matches a library loop exactly, it WAS that loop: relink,
    // so handle edits keep updating it instead of offering a duplicate save.
    const origin = opened.project.loops.find(
      (loop) =>
        loop.region.startSeconds === active.region.startSeconds &&
        loop.region.endSeconds === active.region.endSeconds
    )
    deps.restoreActiveLoop(active, origin?.id ?? null)
  }

  const saved = opened.project.separation
  const separated = saved !== undefined && opened.stems.length > 0
  // Rebuild the separation stems (if any) before seating the metronome, so the
  // click can join them in a single mixer load.
  let restored: RestoredSeparation | undefined
  if (separated) {
    const labelById = new Map(saved.stems.map((stem) => [stem.id, stem.label]))
    // Deliberately sequential: each stored stem's WAV decode is a synchronous
    // main-thread block, so hand the adapter the step — and await it — before
    // decoding, letting it narrate and paint (R.4/AS.4).
    const sources: SeparatedStem[] = []
    for (const [index, stem] of opened.stems.entries()) {
      await deps.onRestoreStep?.({
        stem: index + 1,
        total: opened.stems.length
      })
      sources.push({
        id: stem.id,
        label: labelById.get(stem.id) ?? stem.id,
        audio: decodeWav(stem.bytes)
      })
    }
    restored = await deps.separation.restore(audio, sources)
  }

  // The stored stems could not be rebuilt (corrupt WAV) or a newer action
  // superseded the restore — seat nothing rather than a tempo over an empty mix.
  if (separated && !restored) {
    return
  }

  // Seat the click in the right shape: alongside restored stems (`attach`), or
  // on top of the whole track when un-separated (`enable`).
  const seatMetronome = (
    analysis: TempoAnalysis,
    metronome: MixerChannel | undefined
  ): void => {
    if (separated && restored) {
      deps.metronome.attach(
        analysis.grid,
        restored.stems,
        restored.sources,
        audio,
        saved.mixer,
        metronome
      )
    } else if (!separated) {
      deps.metronome.enable(analysis.grid, audio, metronome)
    }
  }

  const persisted = opened.project.tempo
  if (persisted) {
    // Fast path: tempo + metronome come straight from the manifest — no server.
    // The persisted bpm/grid are already folded; the shift restores the read-out.
    // A manifest predating the enriched contract has no meter — default to 4/4.
    // Sanitizing here self-repairs grids saved before the server filtered out
    // spurious detector beats — the parasite would otherwise click forever.
    const analysis: TempoAnalysis = {
      bpm: persisted.bpm,
      grid: sanitizeBeatGrid(persisted.grid),
      beatsPerBar: persisted.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
    }
    deps.tempo.set(analysis, persisted.octaveShift ?? 0, persisted.manual)
    seatMetronome(analysis, persisted.metronome)
    return
  }

  // Old manifest that predates the tempo field: show the restored stems now,
  // then detect the tempo WITHOUT blocking the restore (the « opening » state
  // must not hang on the tempo server) and seat the adapter's default click
  // when it lands.
  if (separated && restored) {
    deps.mixer.restore(restored.stems, restored.sources, saved.mixer)
  }
  void deps.tempo.detect(audio).then((analysis) => {
    if (analysis) {
      seatMetronome(analysis, undefined)
    }
  })
}
