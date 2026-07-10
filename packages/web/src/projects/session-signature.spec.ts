import { describe, expect, it } from 'vitest'
import { type SignedSession, sessionSignature } from './session-signature.ts'

const base: SignedSession = {
  loops: [
    { id: 'l1', name: 'Refrain', region: { startSeconds: 1, endSeconds: 2 } }
  ],
  markers: [{ id: 'm1', timeSeconds: 3, label: 'Solo' }],
  activeLoop: {
    region: { startSeconds: 1, endSeconds: 2 },
    enabled: true
  },
  separation: {
    mixer: [{ id: 'voix', gainDb: -6, muted: false, soloed: false }]
  }
}

describe('sessionSignature', () => {
  it('signs identical sessions identically, extra fields ignored', () => {
    const saved = {
      ...base,
      // A saved Project narrows to the same shape but carries more (refs,
      // timestamps…) — none of it may skew the comparison.
      separation: {
        mixer: base.separation?.mixer ?? [],
        stems: [{ id: 'voix', label: 'Voix', audioRef: 'ref' }]
      }
    } as SignedSession
    expect(sessionSignature(saved)).toBe(sessionSignature(base))
  })

  it('changes when a loop changes', () => {
    const edited: SignedSession = {
      ...base,
      loops: [
        { id: 'l1', name: 'Pont', region: { startSeconds: 1, endSeconds: 2 } }
      ]
    }
    expect(sessionSignature(edited)).not.toBe(sessionSignature(base))
  })

  it('changes when a marker changes', () => {
    const edited: SignedSession = { ...base, markers: [] }
    expect(sessionSignature(edited)).not.toBe(sessionSignature(base))
  })

  it('changes when the loupe moves or toggles', () => {
    const moved: SignedSession = {
      ...base,
      activeLoop: { region: { startSeconds: 1, endSeconds: 4 }, enabled: true }
    }
    const toggled: SignedSession = {
      ...base,
      activeLoop: { region: { startSeconds: 1, endSeconds: 2 }, enabled: false }
    }
    expect(sessionSignature(moved)).not.toBe(sessionSignature(base))
    expect(sessionSignature(toggled)).not.toBe(sessionSignature(base))
  })

  it('changes when a fader moves', () => {
    const edited: SignedSession = {
      ...base,
      separation: {
        mixer: [{ id: 'voix', gainDb: 0, muted: false, soloed: false }]
      }
    }
    expect(sessionSignature(edited)).not.toBe(sessionSignature(base))
  })

  it('changes when the tuning (tempo/pitch/zoom) changes', () => {
    const slowed: SignedSession = {
      ...base,
      tuning: { timeRatio: 0.85, pitchSemitones: 0, zoom: 1 }
    }
    expect(sessionSignature(slowed)).not.toBe(sessionSignature(base))
  })

  it('signs a manifest that predates tuning like the explicit neutral one', () => {
    const neutral: SignedSession = {
      ...base,
      tuning: { timeRatio: 1, pitchSemitones: 0, zoom: 1 }
    }
    expect(sessionSignature(neutral)).toBe(sessionSignature(base))
  })

  it('tells a session without loupe or separation apart from one with', () => {
    const bare: SignedSession = { loops: [], markers: [] }
    expect(sessionSignature(bare)).not.toBe(sessionSignature(base))
  })

  it('changes when the metronome mute or fader changes', () => {
    const muted: SignedSession = {
      ...base,
      tempo: {
        metronome: { id: 'metronome', gainDb: 0, muted: true, soloed: false }
      }
    }
    const heard: SignedSession = {
      ...base,
      tempo: {
        metronome: { id: 'metronome', gainDb: 0, muted: false, soloed: false }
      }
    }
    expect(sessionSignature(muted)).not.toBe(sessionSignature(heard))
  })

  it('signs an absent metronome like the default muted one (fresh detection)', () => {
    // A manifest with no tempo reopens and re-detects to the default-muted
    // metronome — the two must sign identically so it reads « Enregistré ».
    const defaulted: SignedSession = {
      ...base,
      tempo: {
        metronome: { id: 'metronome', gainDb: 0, muted: true, soloed: false }
      }
    }
    expect(sessionSignature(defaulted)).toBe(sessionSignature(base))
  })

  it('changes when the octave correction changes', () => {
    const metronome = { id: 'metronome', gainDb: 0, muted: true, soloed: false }
    const detected: SignedSession = { ...base, tempo: { metronome } }
    const folded: SignedSession = {
      ...base,
      tempo: { metronome, octaveShift: -1 }
    }
    expect(sessionSignature(folded)).not.toBe(sessionSignature(detected))
  })

  it('signs an absent octave correction like an explicit zero', () => {
    const metronome = { id: 'metronome', gainDb: 0, muted: true, soloed: false }
    const implicit: SignedSession = { ...base, tempo: { metronome } }
    const explicit: SignedSession = {
      ...base,
      tempo: { metronome, octaveShift: 0 }
    }
    expect(sessionSignature(explicit)).toBe(sessionSignature(implicit))
  })

  it('changes when a manual tempo override is set', () => {
    // The override is a user edit (typed/tapped/aligned), unlike the derived
    // detection — setting one must read « Non enregistré ».
    const metronome = { id: 'metronome', gainDb: 0, muted: true, soloed: false }
    const detected: SignedSession = { ...base, tempo: { metronome } }
    const overridden: SignedSession = {
      ...base,
      tempo: { metronome, manual: { bpm: 96, phaseSeconds: 0 } }
    }
    expect(sessionSignature(overridden)).not.toBe(sessionSignature(detected))
  })

  it('changes when the override phase moves', () => {
    const metronome = { id: 'metronome', gainDb: 0, muted: true, soloed: false }
    const anchored: SignedSession = {
      ...base,
      tempo: { metronome, manual: { bpm: 96, phaseSeconds: 0 } }
    }
    const shifted: SignedSession = {
      ...base,
      tempo: { metronome, manual: { bpm: 96, phaseSeconds: 1.25 } }
    }
    expect(sessionSignature(shifted)).not.toBe(sessionSignature(anchored))
  })

  it('signs an absent override like a manifest that predates it', () => {
    const metronome = { id: 'metronome', gainDb: 0, muted: true, soloed: false }
    const old: SignedSession = { ...base, tempo: { metronome } }
    const explicit: SignedSession = {
      ...base,
      tempo: { metronome, manual: undefined }
    }
    expect(sessionSignature(explicit)).toBe(sessionSignature(old))
  })

  it('changes when the chord chart text changes', () => {
    const charted: SignedSession = {
      ...base,
      chordChart: { source: '| Am | F |' }
    }
    const edited: SignedSession = {
      ...base,
      chordChart: { source: '| Am | G |' }
    }
    expect(sessionSignature(charted)).not.toBe(sessionSignature(base))
    expect(sessionSignature(edited)).not.toBe(sessionSignature(charted))
  })

  it('signs an absent chart like an empty one (manifest that predates it)', () => {
    const empty: SignedSession = { ...base, chordChart: { source: '' } }
    expect(sessionSignature(empty)).toBe(sessionSignature(base))
  })
})
