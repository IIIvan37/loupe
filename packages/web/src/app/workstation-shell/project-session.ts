import {
  type DecodedAudio,
  decodeWav,
  encodeWav,
  type LoopLibrary,
  type MarkerList,
  type MixerState,
  type OpenProjectResult,
  type ProjectActiveLoop,
  type ProjectTuning,
  type SaveProjectInput,
  type SeparatedStem,
  tuningOrDefault
} from '@app/core'
import type { Loops } from '../loops/use-loops.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import type { Separation } from '../separation/use-separation.ts'

/** The live session pieces a save snapshots. */
export interface SessionSnapshot {
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
  session: SessionSnapshot
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

/** The session surfaces an open rebuilds, after the shell wiped the slate. */
export interface SessionRestoreDeps {
  readonly importFile: (file: File) => Promise<DecodedAudio | undefined>
  readonly markers: Markers
  readonly loops: Loops
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
  readonly separation: Separation
  readonly mixer: Mixer
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
  const audio = await deps.importFile(
    new File([opened.sourceBytes], opened.project.name)
  )
  // No audio means the re-import was superseded by a newer user import (or
  // failed): the session belongs to that newer track now — restoring the old
  // project's loops/markers onto it would corrupt what a later save persists.
  if (!audio) {
    return
  }
  deps.markers.restore(opened.project.markers)
  deps.loops.restore(opened.project.loops)
  // A manifest that predates the tuning field means neutral settings — seat
  // them too, so the previous session's tempo/pitch never bleeds in.
  deps.restoreTuning(tuningOrDefault(opened.project.tuning))
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
  if (!saved || opened.stems.length === 0) {
    return
  }
  const labelById = new Map(saved.stems.map((stem) => [stem.id, stem.label]))
  const sources: readonly SeparatedStem[] = opened.stems.map((stem) => ({
    id: stem.id,
    label: labelById.get(stem.id) ?? stem.id,
    audio: decodeWav(stem.bytes)
  }))
  const restored = await deps.separation.restore(audio, sources)
  if (restored) {
    deps.mixer.restore(restored.stems, restored.sources, saved.mixer)
  }
}
