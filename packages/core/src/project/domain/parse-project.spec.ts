import { describe, expect, it } from 'vitest'
import { parseProject } from './parse-project.ts'

/** A minimal valid manifest, as JSON.parse would hand it back. */
function minimalManifest(): Record<string, unknown> {
  return {
    id: 'p1',
    name: 'My song',
    createdAt: 1000,
    updatedAt: 2000,
    source: { title: 'Song', artist: 'Band', audioRef: 'a'.repeat(64) },
    loops: [],
    markers: []
  }
}

/** A manifest exercising every optional section with valid content. */
function fullManifest(): Record<string, unknown> {
  return {
    ...minimalManifest(),
    loops: [
      { id: 'l1', name: 'Verse', region: { startSeconds: 1, endSeconds: 2 } }
    ],
    markers: [{ id: 'm1', timeSeconds: 3, label: 'Bridge', kind: 'structure' }],
    activeLoop: {
      region: { startSeconds: 0.5, endSeconds: 4 },
      enabled: true
    },
    tuning: { timeRatio: 0.75, pitchSemitones: -2, zoom: 2, fineTuneCents: 10 },
    tempo: {
      bpm: 120,
      grid: [{ timeSeconds: 0, downbeat: true }],
      beatsPerBar: 4,
      octaveShift: 1,
      manual: { bpm: 120, phaseSeconds: 0.1 },
      metronome: { id: 'metronome', gainDb: 0, muted: false, soloed: false }
    },
    chordChart: { source: '[Verse]\n| C | G |', transposedBy: 2 },
    separation: {
      stems: [{ id: 's1', label: 'Vocals', audioRef: 'b'.repeat(64) }],
      mixer: [{ id: 's1', gainDb: -3, muted: false, soloed: true }]
    }
  }
}

describe('parseProject', () => {
  it('accepts a minimal manifest and returns it verbatim', () => {
    const manifest = minimalManifest()
    expect(parseProject(manifest)).toBe(manifest)
  })

  it('accepts a manifest with every optional section present', () => {
    const manifest = fullManifest()
    expect(parseProject(manifest)).toBe(manifest)
  })

  it('accepts absent title and artist (JSON omits undefined)', () => {
    const manifest = minimalManifest()
    manifest.source = { audioRef: 'a'.repeat(64) }
    expect(parseProject(manifest)).toBeDefined()
  })

  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'project'],
    ['an array', []],
    ['undefined', undefined]
  ])('rejects %s', (_label, value) => {
    expect(parseProject(value)).toBeUndefined()
  })

  it.each([
    ['id missing', (m: Record<string, unknown>) => delete m.id],
    ['id empty', (m: Record<string, unknown>) => (m.id = '')],
    ['id not a string', (m: Record<string, unknown>) => (m.id = 7)],
    ['name not a string', (m: Record<string, unknown>) => (m.name = null)],
    [
      'createdAt not a number',
      (m: Record<string, unknown>) => (m.createdAt = 'yesterday')
    ],
    [
      'updatedAt not finite',
      (m: Record<string, unknown>) => (m.updatedAt = Number.NaN)
    ],
    ['source missing', (m: Record<string, unknown>) => delete m.source],
    ['source not an object', (m: Record<string, unknown>) => (m.source = 3)],
    [
      'source.audioRef missing',
      (m: Record<string, unknown>) => (m.source = { title: 'Song' })
    ],
    [
      'source.audioRef empty',
      (m: Record<string, unknown>) => (m.source = { audioRef: '' })
    ],
    [
      'source.title not a string',
      (m: Record<string, unknown>) =>
        (m.source = { title: 42, audioRef: 'a'.repeat(64) })
    ],
    ['loops not an array', (m: Record<string, unknown>) => (m.loops = {})],
    ['markers missing', (m: Record<string, unknown>) => delete m.markers]
  ])('rejects a manifest with %s', (_label, mutate) => {
    const manifest = minimalManifest()
    mutate(manifest)
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['a loop without a region', { id: 'l1', name: 'Verse' }],
    [
      'a loop with a non-numeric edge',
      { id: 'l1', name: 'V', region: { startSeconds: 'a', endSeconds: 2 } }
    ],
    ['a loop that is not an object', 'loop'],
    [
      'a loop with an empty id',
      { id: '', name: 'V', region: { startSeconds: 1, endSeconds: 2 } }
    ],
    [
      'a loop with a non-string name',
      { id: 'l1', name: 7, region: { startSeconds: 1, endSeconds: 2 } }
    ]
  ])('rejects %s', (_label, loop) => {
    const manifest = minimalManifest()
    manifest.loops = [loop]
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['a marker without a label', { id: 'm1', timeSeconds: 3 }],
    [
      'a marker with a non-numeric time',
      { id: 'm1', timeSeconds: null, label: 'x' }
    ],
    ['a marker without an id', { timeSeconds: 3, label: 'x' }]
  ])('rejects %s', (_label, marker) => {
    const manifest = minimalManifest()
    manifest.markers = [marker]
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['activeLoop without a region', { enabled: true }],
    [
      'activeLoop with a non-boolean enabled',
      { region: { startSeconds: 0, endSeconds: 1 }, enabled: 'yes' }
    ]
  ])('rejects a manifest with %s', (_label, activeLoop) => {
    const manifest = minimalManifest()
    manifest.activeLoop = activeLoop
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['a non-object tuning', 'fast'],
    ['a tuning missing zoom', { timeRatio: 1, pitchSemitones: 0 }],
    [
      'a tuning with a non-numeric ratio',
      { timeRatio: '1', pitchSemitones: 0, zoom: 1 }
    ]
  ])('rejects a manifest with %s', (_label, tuning) => {
    const manifest = minimalManifest()
    manifest.tuning = tuning
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['a tempo without a grid', { bpm: 120, metronome: metronome() }],
    [
      'a tempo with a malformed beat',
      { bpm: 120, grid: [{ timeSeconds: 0 }], metronome: metronome() }
    ],
    [
      'a tempo with a non-numeric bpm',
      { bpm: 'fast', grid: [], metronome: metronome() }
    ],
    ['a tempo without a metronome channel', { bpm: 120, grid: [] }],
    [
      'a tempo with a malformed metronome',
      { bpm: 120, grid: [], metronome: { id: 'click' } }
    ],
    [
      'a tempo with a non-numeric beatsPerBar',
      { bpm: 120, grid: [], metronome: metronome(), beatsPerBar: 'three' }
    ],
    [
      'a tempo with a malformed manual override',
      { bpm: 120, grid: [], metronome: metronome(), manual: { bpm: 120 } }
    ],
    [
      'a tempo with a non-numeric beat time',
      {
        bpm: 120,
        grid: [{ timeSeconds: 'zero', downbeat: true }],
        metronome: metronome()
      }
    ],
    [
      'a tempo whose metronome misses one flag',
      { bpm: 120, grid: [], metronome: { ...metronome(), soloed: undefined } }
    ],
    [
      'a tempo whose metronome has a non-numeric gain',
      { bpm: 120, grid: [], metronome: { ...metronome(), gainDb: 'loud' } }
    ],
    [
      'a tempo whose metronome has an empty id',
      { bpm: 120, grid: [], metronome: { ...metronome(), id: '' } }
    ],
    [
      'a manual override with a non-numeric bpm',
      {
        bpm: 120,
        grid: [],
        metronome: metronome(),
        manual: { bpm: 'fast', phaseSeconds: 0 }
      }
    ]
  ])('rejects a manifest with %s', (_label, tempo) => {
    const manifest = minimalManifest()
    manifest.tempo = tempo
    expect(parseProject(manifest)).toBeUndefined()
  })

  it('rejects a manifest whose chart has a non-string source', () => {
    const manifest = minimalManifest()
    manifest.chordChart = { source: 42 }
    expect(parseProject(manifest)).toBeUndefined()
  })

  it.each([
    ['a separation without stems', { mixer: [] }],
    [
      'a stem without an audioRef',
      { stems: [{ id: 's1', label: 'Vocals' }], mixer: [] }
    ],
    [
      'a mixer channel without flags',
      {
        stems: [{ id: 's1', label: 'V', audioRef: 'b'.repeat(64) }],
        mixer: [{ id: 's1', gainDb: 0 }]
      }
    ],
    [
      'a stem with an empty id',
      { stems: [{ id: '', label: 'V', audioRef: 'b'.repeat(64) }], mixer: [] }
    ],
    [
      'a stem with a non-string label',
      { stems: [{ id: 's1', label: 7, audioRef: 'b'.repeat(64) }], mixer: [] }
    ]
  ])('rejects a manifest with %s', (_label, separation) => {
    const manifest = minimalManifest()
    manifest.separation = separation
    expect(parseProject(manifest)).toBeUndefined()
  })

  // The per-field normalizers (chartTransposedBy, fineTuneOrDefault) already
  // read corrupted values as their defaults — a garbage value there must not
  // condemn the whole manifest, or their leniency would be dead code.
  it.each([
    [
      'a garbage fineTuneCents',
      (m: Record<string, unknown>) =>
        (m.tuning = {
          timeRatio: 1,
          pitchSemitones: 0,
          zoom: 1,
          fineTuneCents: 'x'
        })
    ],
    [
      'a garbage chart transposedBy',
      (m: Record<string, unknown>) =>
        (m.chordChart = { source: '| C |', transposedBy: 'up' })
    ],
    [
      'an unknown marker kind',
      (m: Record<string, unknown>) =>
        (m.markers = [{ id: 'm1', timeSeconds: 1, label: 'x', kind: 'banana' }])
    ],
    [
      'unknown extra fields',
      (m: Record<string, unknown>) => (m.futureField = { anything: true })
    ]
  ])('tolerates %s', (_label, mutate) => {
    const manifest = minimalManifest()
    mutate(manifest)
    expect(parseProject(manifest)).toBeDefined()
  })
})

function metronome(): Record<string, unknown> {
  return { id: 'metronome', gainDb: 0, muted: false, soloed: false }
}
