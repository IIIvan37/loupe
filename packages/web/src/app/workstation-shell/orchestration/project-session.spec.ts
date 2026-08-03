// @vitest-environment jsdom
import {
  type DecodedAudio,
  encodeWav,
  initialSeparation,
  type LoopRegion,
  type OpenProjectResult,
  type Project,
  type SeparatedStem,
  type TempoAnalysis
} from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../../i18n/i18n.ts'
import type { Loops } from '../../loops/use-loops.ts'
import type { Markers } from '../../markers/use-markers.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import type {
  Separation,
  SeparationResult
} from '../../separation/use-separation.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../../tempo/metronome-stem.ts'
import { restoreSession } from './project-session.ts'

/**
 * The restore POLICIES are tested in the core (`restoreSession` in
 * `@app/core`); this spec covers only what the adapter contributes on top:
 * the `File` handed to the decode path, the i18n'd structure-kind
 * re-adoption, the default-muted click's identity, and the paced narration.
 */

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }
const voix: SeparatedStem = { id: 'voix', label: 'Voix', audio }
const basse: SeparatedStem = { id: 'basse', label: 'Basse', audio }

const baseProject: Project = {
  id: 'p1',
  name: 'Mon projet',
  createdAt: 1000,
  updatedAt: 1000,
  source: { title: 'Song', artist: 'Band', audioRef: 'src' },
  loops: [
    { id: 'l1', name: 'Refrain', region: { startSeconds: 1, endSeconds: 2 } }
  ],
  markers: [{ id: 'm1', timeSeconds: 3, label: 'Repère 1' }]
}

function fakeDeps(
  restored: SeparationResult | undefined,
  detected: TempoAnalysis | undefined = undefined
) {
  return {
    importFile: vi.fn(async (_file: File) => audio),
    markers: {
      markers: [],
      addAt: vi.fn(),
      addSectionAt: vi.fn(),
      rename: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
      setSections: vi.fn(),
      clear: vi.fn(),
      restore: vi.fn()
    } satisfies Markers,
    loops: {
      library: [],
      save: vi.fn((name: string, region: LoopRegion) => ({
        id: 'fresh',
        name,
        region
      })),
      update: vi.fn(),
      remove: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn()
    } satisfies Loops,
    restoreActiveLoop: vi.fn(),
    restoreTuning: vi.fn(),
    restoreChordChart: vi.fn(),
    tempo: {
      analysis: undefined,
      octaveShift: 0,
      manual: undefined,
      detect: vi.fn(async () => detected),
      set: vi.fn(),
      reset: vi.fn()
    },
    metronome: {
      enable: vi.fn(),
      attach: vi.fn(),
      reset: vi.fn()
    },
    setSuppressAutoDetect: vi.fn(),
    separation: {
      state: initialSeparation,
      sources: [],
      separate: vi.fn(async () => undefined),
      restore: vi.fn<Separation['restore']>(async () => restored),
      downloadStem: vi.fn(async () => false),
      exportStems: vi.fn(async () => false),
      exportError: undefined,
      dismissExportError: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
      gateReason: undefined
    } satisfies Separation,
    mixer: {
      channels: [],
      state: [],
      load: vi.fn(),
      restore: vi.fn(),
      addStem: vi.fn(),
      removeStem: vi.fn(),
      replaceStem: vi.fn(),
      reset: vi.fn(),
      setGain: vi.fn(),
      toggleMute: vi.fn(),
      toggleSolo: vi.fn(),
      setFilter: vi.fn()
    } satisfies Mixer
  }
}

describe('restoreSession (adapter mapping)', () => {
  it('hands the decode path a File named after the project', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    const file = deps.importFile.mock.calls[0]?.[0] as unknown as File
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('Mon projet')
    expect(deps.loops.restore).toHaveBeenCalledWith(baseProject.loops)
  })

  it('re-adopts the structure kind on a pre-kinds save (no duplicate labels)', async () => {
    // A project saved before marker kinds persisted its detected structure
    // markers as plain markers. Restored verbatim they'd read as cues, and
    // the next « Détecter la structure » would ADD a fresh set beside them —
    // the duplicated-labels bug. The section vocabulary (display copy, i18n —
    // which is why this adoption lives in the adapter) re-adopts its kind.
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: {
        ...baseProject,
        markers: [
          {
            id: 'm1',
            timeSeconds: 0,
            label: i18n._('structure.section.intro')
          },
          { id: 'm2', timeSeconds: 3, label: 'Repère 1' }
        ]
      },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.markers.restore).toHaveBeenCalledWith([
      {
        id: 'm1',
        timeSeconds: 0,
        label: i18n._('structure.section.intro'),
        kind: 'structure'
      },
      { id: 'm2', timeSeconds: 3, label: 'Repère 1' }
    ])
  })

  it('seats the default-muted click when an old manifest re-detects its tempo', async () => {
    // The core hands the adapter NO channel on this path — the identity of the
    // click lane (and the muted-by-default product settings) are seated here.
    const detected: TempoAnalysis = {
      bpm: 100,
      grid: [{ timeSeconds: 0, downbeat: true }],
      beatsPerBar: 4
    }
    const deps = fakeDeps(undefined, detected)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    await vi.waitFor(() => {
      expect(deps.metronome.enable).toHaveBeenCalledWith(
        detected.grid,
        audio,
        DEFAULT_METRONOME_CHANNEL
      )
    })
  })

  it('narrates each stored stem behind a paint (AS.4)', async () => {
    const savedMixer = [{ id: 'voix', gainDb: -6, muted: false, soloed: false }]
    const twoStemProject: Project = {
      ...baseProject,
      separation: {
        stems: [
          { id: 'voix', label: 'Voix', audioRef: 'a1' },
          { id: 'basse', label: 'Basse', audioRef: 'a2' }
        ],
        mixer: savedMixer
      }
    }
    const deps = fakeDeps({ stems: [], sources: [voix, basse] })
    const steps: Array<{ stem: number; total: number }> = []
    const wav = encodeWav(audio.channels, audio.sampleRate)
      .buffer as ArrayBuffer
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: twoStemProject,
      sourceBytes: new ArrayBuffer(4),
      stems: [
        { id: 'voix', bytes: wav },
        { id: 'basse', bytes: wav }
      ]
    }

    await restoreSession(opened, {
      ...deps,
      onRestoreStep: (step) => steps.push(step)
    })

    expect(steps).toEqual([
      { stem: 1, total: 2 },
      { stem: 2, total: 2 }
    ])
  })
})
