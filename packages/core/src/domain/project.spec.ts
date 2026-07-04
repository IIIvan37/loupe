import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { LoopLibrary } from './loop-library.ts'
import type { MarkerList } from './marker-list.ts'
import type { MixerState } from './mixer.ts'
import {
  mixerMatchesStems,
  type ProjectActiveLoop,
  type ProjectSeparation,
  type ProjectStamp,
  type ProjectTempo,
  type ProjectTuning,
  projectFromSession,
  type SessionSnapshot,
  tuningOrDefault
} from './project.ts'

const source = {
  title: 'Blue in Green',
  artist: 'Miles Davis',
  audioRef: 'audio/original'
} as const

const loops: LoopLibrary = [
  { id: 'l1', name: 'head', region: { startSeconds: 0, endSeconds: 4 } }
]
const markers: MarkerList = [{ id: 'm1', timeSeconds: 2, label: 'chorus' }]

const separation: ProjectSeparation = {
  stems: [
    { id: 'voice', label: 'Voice', audioRef: 'audio/voice' },
    { id: 'drums', label: 'Drums', audioRef: 'audio/drums' }
  ],
  mixer: [
    { id: 'voice', gainDb: 0, muted: false, soloed: false },
    { id: 'drums', gainDb: -3, muted: true, soloed: false }
  ] satisfies MixerState
}

const stamp: ProjectStamp = {
  id: 'p1',
  name: 'My take',
  now: 1_700_000_000_000
}

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return { source, loops, markers, ...overrides }
}

describe('projectFromSession', () => {
  it('stamps the caller-minted id and name', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect(project.id).toBe('p1')
    expect(project.name).toBe('My take')
  })

  it('sets both createdAt and updatedAt to the injected instant', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect(project.createdAt).toBe(stamp.now)
    expect(project.updatedAt).toBe(stamp.now)
  })

  it('carries the source, loops and markers through unchanged', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect(project.source).toEqual(source)
    expect(project.loops).toEqual(loops)
    expect(project.markers).toEqual(markers)
  })

  it('carries the armed A/B region — the loupe — through when present', () => {
    const activeLoop: ProjectActiveLoop = {
      region: { startSeconds: 1.5, endSeconds: 6 },
      enabled: false
    }
    const project = projectFromSession(snapshot({ activeLoop }), stamp)
    expect(project.activeLoop).toEqual(activeLoop)
  })

  it('omits activeLoop when the session has no armed region', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect('activeLoop' in project).toBe(false)
  })

  it('carries the playback tuning through when present', () => {
    const tuning: ProjectTuning = {
      timeRatio: 0.85,
      pitchSemitones: -2,
      zoom: 3
    }
    const project = projectFromSession(snapshot({ tuning }), stamp)
    expect(project.tuning).toEqual(tuning)
  })

  it('omits tuning when the session carries none', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect('tuning' in project).toBe(false)
  })

  it('carries the tempo analysis and metronome settings through when present', () => {
    const tempo: ProjectTempo = {
      bpm: 120,
      grid: [
        { timeSeconds: 0, downbeat: true },
        { timeSeconds: 0.5, downbeat: false }
      ],
      metronome: { id: 'metronome', gainDb: -6, muted: false, soloed: false }
    }
    const project = projectFromSession(snapshot({ tempo }), stamp)
    expect(project.tempo).toEqual(tempo)
  })

  it('omits tempo when the session carries none', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect('tempo' in project).toBe(false)
  })

  it('omits separation for an unseparated session', () => {
    const project = projectFromSession(snapshot(), stamp)
    expect(project.separation).toBeUndefined()
    expect('separation' in project).toBe(false)
  })

  it('carries the separation (stems + mixer) through when present', () => {
    const project = projectFromSession(snapshot({ separation }), stamp)
    expect(project.separation).toEqual(separation)
  })

  it('preserves fields across arbitrary snapshots and stamps', () => {
    const arbSnapshot = fc.record({
      source: fc.record({
        title: fc.option(fc.string(), { nil: undefined }),
        artist: fc.option(fc.string(), { nil: undefined }),
        audioRef: fc.string()
      }),
      loops: fc.constant(loops),
      markers: fc.constant(markers)
    })
    const arbStamp = fc.record({
      id: fc.string(),
      name: fc.string(),
      now: fc.integer()
    })
    fc.assert(
      fc.property(arbSnapshot, arbStamp, (snap, stmp) => {
        const project = projectFromSession(snap, stmp)
        expect(project.id).toBe(stmp.id)
        expect(project.name).toBe(stmp.name)
        expect(project.createdAt).toBe(stmp.now)
        expect(project.updatedAt).toBe(stmp.now)
        expect(project.source).toBe(snap.source)
        expect(project.loops).toBe(snap.loops)
        expect(project.markers).toBe(snap.markers)
      })
    )
  })
})

describe('tuningOrDefault', () => {
  it('fills in the neutral tuning for a manifest that predates the field', () => {
    expect(tuningOrDefault(undefined)).toEqual({
      timeRatio: 1,
      pitchSemitones: 0,
      zoom: 1
    })
  })

  it('returns a persisted tuning unchanged', () => {
    const tuning: ProjectTuning = { timeRatio: 0.7, pitchSemitones: 2, zoom: 4 }
    expect(tuningOrDefault(tuning)).toBe(tuning)
  })
})

describe('mixerMatchesStems', () => {
  const mixer: MixerState = [
    { id: 'voice', gainDb: 0, muted: false, soloed: false },
    { id: 'drums', gainDb: -3, muted: true, soloed: false }
  ]

  it('accepts a mixer whose channel ids equal the stem ids, in any order', () => {
    expect(mixerMatchesStems(['voice', 'drums'], mixer)).toBe(true)
    expect(mixerMatchesStems(['drums', 'voice'], mixer)).toBe(true)
  })

  it('rejects a mixer channel with no matching stem', () => {
    expect(mixerMatchesStems(['voice'], mixer)).toBe(false)
  })

  it('rejects a stem with no matching mixer channel', () => {
    expect(mixerMatchesStems(['voice', 'drums', 'bass'], mixer)).toBe(false)
  })

  it('accepts the empty separation', () => {
    expect(mixerMatchesStems([], [])).toBe(true)
  })
})
