import {
  type DecodedAudio,
  encodeWav,
  initialSeparation,
  type LoopRegion,
  type MixerState,
  type OpenProjectResult,
  type Project,
  type ProjectTempo,
  type SeparatedStem,
  type StemSet,
  type TempoAnalysis
} from '@app/core'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import type { Loops } from '../loops/use-loops.ts'
import type { Markers } from '../markers/use-markers.ts'
import type { Mixer } from '../mixer/use-mixer.ts'
import type {
  Separation,
  SeparationResult
} from '../separation/use-separation.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../tempo/metronome-stem.ts'
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

  it('carries the tempo analysis and metronome settings into the save input', () => {
    const tempo: ProjectTempo = {
      bpm: 96,
      grid: [{ timeSeconds: 0, downbeat: true }],
      metronome: { id: 'metronome', gainDb: -3, muted: false, soloed: false }
    }
    const input = sessionSaveInput({
      bytes: new ArrayBuffer(4),
      title: 'Song',
      artist: 'Band',
      loops: [],
      markers: [],
      tuning: neutralTuning,
      tempo
    })
    expect(input.tempo).toEqual(tempo)
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

  function fakeDeps(
    restored: SeparationResult | undefined,
    detected: TempoAnalysis | undefined = undefined
  ) {
    return {
      importFile: vi.fn(async () => audio),
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
        downloadStem: vi.fn(() => false),
        exportStems: vi.fn(async () => false),
        exportError: undefined,
        dismissExportError: vi.fn(),
        cancel: vi.fn(),
        reset: vi.fn()
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

  it('re-adopts the structure kind on a pre-kinds save (no duplicate labels)', async () => {
    // A project saved before marker kinds persisted its detected structure
    // markers as plain markers. Restored verbatim they'd read as cues, and
    // the next « Détecter la structure » would ADD a fresh set beside them —
    // the duplicated-labels bug. The section vocabulary re-adopts its kind.
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

  it('suppresses the shell auto-detect while the open owns tempo seating', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: baseProject,
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.setSuppressAutoDetect).toHaveBeenCalledWith(true)
  })

  const savedTempo: ProjectTempo = {
    bpm: 120,
    grid: [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 0.5, downbeat: false }
    ],
    metronome: { id: 'metronome', gainDb: -6, muted: false, soloed: false }
  }

  it('restores the persisted tempo and seats an un-separated metronome', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: { ...baseProject, tempo: savedTempo },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    // Seated from the manifest — no detection (no server). A manifest without an
    // octave correction restores at the neutral shift 0; one without a meter
    // (predating the enriched contract) restores at common time.
    expect(deps.tempo.set).toHaveBeenCalledWith(
      { bpm: savedTempo.bpm, grid: savedTempo.grid, beatsPerBar: 4 },
      0,
      undefined
    )
    expect(deps.tempo.detect).not.toHaveBeenCalled()
    expect(deps.metronome.enable).toHaveBeenCalledWith(
      savedTempo.grid,
      audio,
      savedTempo.metronome
    )
  })

  it('sanitizes a persisted grid carrying a spurious detector beat', async () => {
    // A grid saved BEFORE the server-side filter existed still carries the
    // double-fire: restoring must not seat the parasite into the metronome
    // click and the waveform grid — the manifest self-repairs on open.
    const parasiteTempo: ProjectTempo = {
      ...savedTempo,
      bpm: 75,
      grid: [
        { timeSeconds: 0, downbeat: true },
        { timeSeconds: 0.8, downbeat: false },
        { timeSeconds: 1.6, downbeat: false },
        { timeSeconds: 1.68, downbeat: false },
        { timeSeconds: 2.4, downbeat: false },
        { timeSeconds: 3.2, downbeat: false }
      ]
    }
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: { ...baseProject, tempo: parasiteTempo },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    const cleaned = parasiteTempo.grid.filter(
      (beat) => beat.timeSeconds !== 1.68
    )
    expect(deps.metronome.enable).toHaveBeenCalledWith(
      cleaned,
      audio,
      parasiteTempo.metronome
    )
  })

  it('restores the persisted octave correction', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: {
        ...baseProject,
        tempo: { ...savedTempo, octaveShift: -1 }
      },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.tempo.set).toHaveBeenCalledWith(
      { bpm: savedTempo.bpm, grid: savedTempo.grid, beatsPerBar: 4 },
      -1,
      undefined
    )
  })

  it('restores the persisted meter', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: {
        ...baseProject,
        tempo: { ...savedTempo, beatsPerBar: 3 }
      },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    expect(deps.tempo.set).toHaveBeenCalledWith(
      { bpm: savedTempo.bpm, grid: savedTempo.grid, beatsPerBar: 3 },
      0,
      undefined
    )
  })

  it('restores the persisted manual override', async () => {
    const deps = fakeDeps(undefined)
    const opened: Extract<OpenProjectResult, { ok: true }> = {
      ok: true,
      project: {
        ...baseProject,
        tempo: { ...savedTempo, manual: { bpm: 96, phaseSeconds: 0.5 } }
      },
      sourceBytes: new ArrayBuffer(4),
      stems: []
    }

    await restoreSession(opened, deps)

    // The override state comes back with the analysis, so further edits
    // (retype, re-align) continue from it and the session signs equal.
    expect(deps.tempo.set).toHaveBeenCalledWith(expect.anything(), 0, {
      bpm: 96,
      phaseSeconds: 0.5
    })
  })

  it('attaches the metronome onto the restored stems for a separated project', async () => {
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
      project: { ...project, tempo: savedTempo },
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

    // The click joins the stems in one pass; the plain mixer.restore is not used.
    expect(deps.metronome.attach).toHaveBeenCalledWith(
      savedTempo.grid,
      restored.stems,
      restored.sources,
      audio,
      savedMixer,
      savedTempo.metronome
    )
    expect(deps.mixer.restore).not.toHaveBeenCalled()
  })

  it('detects the tempo for an old manifest and seats a muted metronome', async () => {
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

    expect(deps.tempo.detect).toHaveBeenCalledWith(audio)
    // Detection is fire-and-forget (it must not block the open) — the click
    // seats muted by default once it lands.
    await vi.waitFor(() => {
      expect(deps.metronome.enable).toHaveBeenCalledWith(
        detected.grid,
        audio,
        DEFAULT_METRONOME_CHANNEL
      )
    })
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
