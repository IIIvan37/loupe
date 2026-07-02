import {
  type DecodedAudio,
  encodeWav,
  initialSeparation,
  type LoopRegion,
  type MixerState,
  type OpenProjectResult,
  type Project,
  type SeparatedStem,
  type StemSet
} from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import type { Loops } from '../loops/use-loops.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import type {
  Separation,
  SeparationResult
} from '../separation/use-separation.ts'
import { restoreSession, sessionSaveInput } from './project-session.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

const voix: SeparatedStem = { id: 'voix', label: 'Voix', audio }
const basse: SeparatedStem = { id: 'basse', label: 'Basse', audio }

describe('sessionSaveInput', () => {
  it('snapshots the session without stems when nothing is mixing', () => {
    const input = sessionSaveInput({
      bytes: new ArrayBuffer(4),
      title: 'Song',
      artist: 'Band',
      loops: [],
      markers: []
    })
    expect(input.separation).toBeUndefined()
    expect(input.source.title).toBe('Song')
  })

  it('persists only the stems the mixer holds a channel for, as WAV bytes', () => {
    // The mixer mixes one of the two sources — only that pair may be saved.
    const mixer: MixerState = [
      { id: 'voix', gainDb: -6, muted: false, soloed: false }
    ]
    const input = sessionSaveInput({
      bytes: new ArrayBuffer(4),
      title: undefined,
      artist: undefined,
      loops: [],
      markers: [],
      separation: { sources: [voix, basse], mixer }
    })
    expect(input.separation?.mixer).toEqual(mixer)
    expect(input.separation?.stems.map((stem) => stem.id)).toEqual(['voix'])
    expect(input.separation?.stems[0]?.bytes).toEqual(
      encodeWav(audio.channels, audio.sampleRate).buffer
    )
  })
})

describe('restoreSession', () => {
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
  const savedMixer: MixerState = [
    { id: 'voix', gainDb: -6, muted: false, soloed: false }
  ]
  const project: Project = {
    ...baseProject,
    separation: {
      stems: [{ id: 'voix', label: 'Voix', audioRef: 'a1' }],
      mixer: savedMixer
    }
  }

  function fakeDeps(restored: SeparationResult | undefined) {
    return {
      importFile: vi.fn(async () => audio),
      markers: {
        markers: [],
        addAt: vi.fn(),
        rename: vi.fn(),
        remove: vi.fn(),
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
      separation: {
        state: initialSeparation,
        sources: [],
        separate: vi.fn(async () => undefined),
        restore: vi.fn<Separation['restore']>(async () => restored),
        downloadStem: vi.fn(),
        reset: vi.fn()
      } satisfies Separation,
      mixer: {
        channels: [],
        state: [],
        mixWaveform: { peaks: [] },
        load: vi.fn(),
        restore: vi.fn(),
        reset: vi.fn(),
        setGain: vi.fn(),
        toggleMute: vi.fn(),
        toggleSolo: vi.fn()
      } satisfies Mixer
    }
  }

  it('re-imports the bytes, restores markers/loops and seats the saved mixer', async () => {
    const stems: StemSet = [
      {
        id: 'voix',
        label: 'Voix',
        track: { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } },
        confidence: 1,
        present: true
      }
    ]
    const restored: SeparationResult = { stems, sources: [voix] }
    const deps = fakeDeps(restored)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project,
      sourceBytes: new ArrayBuffer(4),
      stems: [
        {
          id: 'voix',
          bytes: encodeWav(audio.channels, audio.sampleRate)
            .buffer as ArrayBuffer
        }
      ]
    }

    await restoreSession(opened, deps)

    expect(deps.importFile).toHaveBeenCalledOnce()
    expect(deps.markers.restore).toHaveBeenCalledWith(project.markers)
    expect(deps.loops.restore).toHaveBeenCalledWith(project.loops)
    // The stored WAV round-trips into the separation pipeline by id + label.
    const call = deps.separation.restore.mock.calls[0]
    expect(call?.[0]).toEqual(audio)
    expect(
      call?.[1].map((stem) => ({ id: stem.id, label: stem.label }))
    ).toEqual([{ id: 'voix', label: 'Voix' }])
    expect(deps.mixer.restore).toHaveBeenCalledWith(
      restored.stems,
      restored.sources,
      savedMixer
    )
  })

  it('stops after markers and loops when the project has no separation', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.loops.restore).toHaveBeenCalledOnce()
    expect(deps.separation.restore).not.toHaveBeenCalled()
    expect(deps.mixer.restore).not.toHaveBeenCalled()
  })
})
