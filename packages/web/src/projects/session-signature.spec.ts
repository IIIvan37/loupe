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

  it('tells a session without loupe or separation apart from one with', () => {
    const bare: SignedSession = { loops: [], markers: [] }
    expect(sessionSignature(bare)).not.toBe(sessionSignature(base))
  })
})
