import {
  type SessionRestoreDeps as CoreRestoreDeps,
  type DecodedAudio,
  type OpenProjectResult,
  restoreSession as restoreSessionCore,
  type TrackMetadata
} from '@app/core'
import { nextPaint } from '../../../lib/next-paint.ts'
import type { Loops } from '../../loops/use-loops.ts'
import { adoptStructureKinds } from '../../markers/section-markers.ts'
import type { Markers } from '../../markers/use-markers.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import type { Separation } from '../../separation/use-separation.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../../tempo/metronome-stem.ts'
import type { Metronome } from '../../tempo/use-metronome.ts'
import type { Tempo } from '../../tempo/use-tempo.ts'

/**
 * The restore's dependencies in the SHELL's vocabulary — the live feature
 * hooks. `restoreSession` below maps them onto the core use-case's ports; the
 * policies themselves (restore order, loupe relink, tempo fast path) live in
 * the core (`restoreSession` in `@app/core`).
 */
export interface SessionRestoreDeps {
  readonly importFile: (
    file: File,
    fallbackMetadata?: TrackMetadata
  ) => Promise<DecodedAudio | undefined>
  readonly markers: Markers
  readonly loops: Loops
  readonly restoreActiveLoop: CoreRestoreDeps['restoreActiveLoop']
  readonly restoreTuning: CoreRestoreDeps['restoreTuning']
  readonly restoreChordChart: CoreRestoreDeps['restoreChordChart']
  readonly separation: Separation
  readonly mixer: Mixer
  readonly tempo: Pick<
    Tempo,
    'analysis' | 'octaveShift' | 'manual' | 'detect' | 'set' | 'reset'
  >
  readonly metronome: Pick<Metronome, 'enable' | 'attach' | 'reset'>
  readonly setSuppressAutoDetect: (suppress: boolean) => void
  /** Narrate the restore's stem-decode steps (« Piste n/total ») — the core
   * awaits the adapter, which lets the chip PAINT before each synchronous WAV
   * decode (AS.4). */
  readonly onRestoreStep?: (step: {
    readonly stem: number
    readonly total: number
  }) => void
}

/**
 * Rebuild the working session from an opened project — the core use-case
 * behind the shell's hooks. This adapter contributes only what the pure core
 * cannot own: the `File` the decode path takes, the paint between two
 * synchronous stem decodes, the i18n'd structure-kind re-adoption on pre-kinds
 * manifests, and the metronome lane's identity (ADR 0012) behind the
 * default-muted click.
 */
export function restoreSession(
  opened: Extract<OpenProjectResult, { ok: true }>,
  deps: SessionRestoreDeps
): Promise<void> {
  return restoreSessionCore(opened, {
    importAudio: (bytes, name) => deps.importFile(new File([bytes], name)),
    // Pre-kinds saves persisted detected structure markers as plain markers;
    // the section vocabulary (display copy — i18n) re-adopts its kind so the
    // next detection REPLACES them instead of duplicating the labels.
    markers: {
      restore: (markers) => deps.markers.restore(adoptStructureKinds(markers))
    },
    loops: { restore: (loops) => deps.loops.restore(loops) },
    restoreActiveLoop: deps.restoreActiveLoop,
    restoreTuning: deps.restoreTuning,
    restoreChordChart: deps.restoreChordChart,
    separation: {
      restore: (audio, sources) => deps.separation.restore(audio, sources)
    },
    mixer: {
      restore: (stems, sources, mixer) =>
        deps.mixer.restore(stems, sources, mixer)
    },
    tempo: {
      set: (analysis, octaveShift, manual) =>
        deps.tempo.set(analysis, octaveShift, manual),
      detect: (audio) => deps.tempo.detect(audio)
    },
    // An old manifest carries no click channel: seat the default-muted one —
    // its id is the mixer's synthetic-lane identity, unknown to the core.
    metronome: {
      enable: (grid, audio, metronome) =>
        deps.metronome.enable(
          grid,
          audio,
          metronome ?? DEFAULT_METRONOME_CHANNEL
        ),
      attach: (grid, stems, sources, audio, mixer, metronome) =>
        deps.metronome.attach(
          grid,
          stems,
          sources,
          audio,
          mixer,
          metronome ?? DEFAULT_METRONOME_CHANNEL
        )
    },
    setSuppressAutoDetect: deps.setSuppressAutoDetect,
    onRestoreStep: async (step) => {
      deps.onRestoreStep?.(step)
      await nextPaint()
    }
  })
}
