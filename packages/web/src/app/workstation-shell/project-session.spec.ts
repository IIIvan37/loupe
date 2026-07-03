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

const neutralTuning = { timeRatio: 1, pitchSemitones: 0, zoom: 1 }

describe('sessionSaveInput', () => {
  it('snapshots the session without stems when nothing is mixing', () => {
    const input = sessionSaveInput({
      bytes: new ArrayBuffer(4),
      title: 'Song',
      artist: 'Band',
      loops: [],
      markers: [],
      tuning: neutralTuning
    })
    expect(input.separation).toBeUndefined()
    expect(input.source.title).toBe('Song')
  })

  it('carries the playback tuning into the save input', () => {
    const tuning = { timeRatio: 0.85, pitchSemitones: -2, zoom: 3 }
    const input = sessionSaveInput({
      bytes: new ArrayBuffer(4),
      title: 'Song',
      artist: 'Band',
      loops: [],
      markers: [],
      tuning
    })
    expect(input.tuning).toEqual(tuning)
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
      tuning: neutralTuning,
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
        move: vi.fn(),
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
      restoreActiveLoop: vi.fn(),
      restoreTuning: vi.fn(),
      separation: {
        state: initialSeparation,
        sources: [],
        separate: vi.fn(async () => undefined),
        restore: vi.fn<Separation['restore']>(async () => restored),
        downloadStem: vi.fn(),
        exportStems: vi.fn(async () => undefined),
        exportError: undefined,
        dismissExportError: vi.fn(),
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

  it('restores nothing when the re-import was superseded by a newer one', async () => {
    // A stale open resolving after the user imported a fresh file: the
    // supersede guard makes importFile resolve undefined — the old project's
    // loops/markers must not land on the track imported meanwhile.
    const deps = {
      ...fakeDeps(undefined),
      importFile: vi.fn(async () => undefined)
    }
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.loops.restore).not.toHaveBeenCalled()
  })

  it('re-arms the persisted loupe, relinked to the saved loop it came from', async () => {
    const deps = fakeDeps(undefined)
    const activeLoop = {
      region: { startSeconds: 1, endSeconds: 2 },
      enabled: false
    }
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: { ...baseProject, activeLoop },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    // The region equals library loop l1's exactly — it WAS that loop.
    expect(deps.restoreActiveLoop).toHaveBeenCalledWith(activeLoop, 'l1')
  })

  it('re-arms a never-saved loupe as an unlinked region', async () => {
    const deps = fakeDeps(undefined)
    const activeLoop = {
      region: { startSeconds: 4, endSeconds: 7 },
      enabled: true
    }
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: { ...baseProject, activeLoop },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.restoreActiveLoop).toHaveBeenCalledWith(activeLoop, null)
  })

  it('seats the persisted tuning', async () => {
    const deps = fakeDeps(undefined)
    const tuning = { timeRatio: 0.85, pitchSemitones: -2, zoom: 3 }
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: { ...baseProject, tuning },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.restoreTuning).toHaveBeenCalledWith(tuning)
  })

  it('seats the neutral tuning when the manifest predates the field', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.restoreTuning).toHaveBeenCalledWith(neutralTuning)
  })

  it('leaves the loupe alone when the project saved none', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.restoreActiveLoop).not.toHaveBeenCalled()
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
