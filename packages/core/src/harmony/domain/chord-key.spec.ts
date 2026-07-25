import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { DetectedChordSpan } from './chord-detection.ts'
import {
  detectKey,
  keyAccidental,
  keyName,
  parseKeyName,
  transposeKey
} from './chord-key.ts'

/** A one-bar span of `label` starting at `at` seconds (bars are 2 s here). */
function bar(label: string | undefined, at: number): DetectedChordSpan {
  return { startSeconds: at, endSeconds: at + 2, label }
}

/** Lay a chord progression out as consecutive one-bar spans. */
function progression(
  labels: readonly (string | undefined)[]
): DetectedChordSpan[] {
  return labels.map((label, index) => bar(label, index * 2))
}

describe('keyAccidental', () => {
  it('spells flat keys with flats', () => {
    expect(keyAccidental({ tonicPc: 5, mode: 'major' })).toBe('flat') // F
    expect(keyAccidental({ tonicPc: 10, mode: 'major' })).toBe('flat') // Bb
    expect(keyAccidental({ tonicPc: 2, mode: 'minor' })).toBe('flat') // Dm
  })

  it('spells sharp keys with sharps', () => {
    expect(keyAccidental({ tonicPc: 7, mode: 'major' })).toBe('sharp') // G
    expect(keyAccidental({ tonicPc: 9, mode: 'minor' })).toBe('sharp') // Am
  })

  it('defaults C major / A minor to sharps (no accidentals either way)', () => {
    expect(keyAccidental({ tonicPc: 0, mode: 'major' })).toBe('sharp')
    expect(keyAccidental({ tonicPc: 9, mode: 'minor' })).toBe('sharp')
  })
})

describe('keyName', () => {
  it('names a major key by its (spelled) tonic', () => {
    expect(keyName({ tonicPc: 5, mode: 'major' })).toBe('F')
    expect(keyName({ tonicPc: 10, mode: 'major' })).toBe('Bb') // not A#
    expect(keyName({ tonicPc: 7, mode: 'major' })).toBe('G')
  })

  it('suffixes a minor key with m', () => {
    expect(keyName({ tonicPc: 2, mode: 'minor' })).toBe('Dm')
    expect(keyName({ tonicPc: 10, mode: 'minor' })).toBe('Bbm')
  })
})

describe('detectKey', () => {
  // I–IV–V–vi progressions the Krumhansl correlation resolves unambiguously —
  // the exact tonic AND mode, so the whole correlation path is pinned, not just
  // the flat/sharp outcome.
  it.each([
    ['C major', ['C', 'F', 'G', 'Am', 'C', 'F', 'G', 'C'], 0, 'major'],
    ['G major', ['G', 'C', 'D', 'Em', 'G', 'C', 'D', 'G'], 7, 'major'],
    ['F major', ['F', 'Bb', 'C', 'Dm', 'F', 'Bb', 'C', 'F'], 5, 'major'],
    ['D major', ['D', 'G', 'A', 'Bm', 'D', 'G', 'A', 'D'], 2, 'major'],
    ['Eb major', ['D#', 'G#', 'A#', 'Cm', 'D#', 'G#', 'A#', 'D#'], 3, 'major'],
    ['Bb major', ['A#', 'D#', 'F', 'Gm', 'A#', 'D#', 'F', 'A#'], 10, 'major'],
    ['B major', ['B', 'E', 'F#', 'G#m', 'B', 'E', 'F#', 'B'], 11, 'major'],
    ['A minor', ['Am', 'Dm', 'Em', 'Am', 'F', 'G', 'Am', 'Am'], 9, 'minor'],
    ['D minor', ['Dm', 'Gm', 'Am', 'Dm', 'A#', 'C', 'Dm', 'Dm'], 2, 'minor'],
    ['E minor', ['Em', 'Am', 'Bm', 'Em', 'C', 'D', 'Em', 'Em'], 4, 'minor']
  ] as const)(
    'reads %s as its exact tonic and mode',
    (_name, labels, tonicPc, mode) => {
      expect(detectKey(progression(labels))).toEqual({ tonicPc, mode })
    }
  )

  it('reads the mode from the chords thirds — same roots, flipped quality', () => {
    // The roots C, F, G alone don't fix the mode; the chords' thirds do.
    expect(detectKey(progression(['C', 'F', 'G', 'C']))).toEqual({
      tonicPc: 0,
      mode: 'major'
    })
    expect(detectKey(progression(['Cm', 'Fm', 'Gm', 'Cm']))).toEqual({
      tonicPc: 0,
      mode: 'minor'
    })
  })

  it('weights by held duration, not by count — one long chord anchors the key', () => {
    // Three passing chords would out-vote F by count; held eight seconds, F is
    // the tonal centre and the key is F major.
    const spans: DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 8, label: 'F' },
      bar('A#', 8),
      bar('C', 10),
      bar('Dm', 12)
    ]
    expect(detectKey(spans)).toEqual({ tonicPc: 5, mode: 'major' })
  })

  it('ignores silence and unknown roots', () => {
    // The `H` bar carries no pitch class; the `undefined` bar is silence — both
    // leave the G-major reading untouched.
    expect(
      detectKey(
        progression(['G', 'C', 'D', 'Em', 'G', undefined, 'C', 'H', 'D', 'G'])
      )
    ).toEqual({ tonicPc: 7, mode: 'major' })
  })

  it('ignores a zero- or negative-length span', () => {
    // A degenerate span (end ≤ start) contributes no weight, so a lone real
    // chord still decides — here C major.
    const spans: DetectedChordSpan[] = [
      { startSeconds: 5, endSeconds: 5, label: 'A#' },
      { startSeconds: 4, endSeconds: 2, label: 'F#' },
      bar('C', 0)
    ]
    expect(detectKey(spans)).toEqual({ tonicPc: 0, mode: 'major' })
  })

  it('falls back to C major on no usable chords', () => {
    expect(detectKey(progression([undefined, undefined]))).toEqual({
      tonicPc: 0,
      mode: 'major'
    })
    expect(detectKey([])).toEqual({ tonicPc: 0, mode: 'major' })
  })
})

describe('parseKeyName', () => {
  it('reads a major key name back into its Key (inverse of keyName)', () => {
    expect(parseKeyName('Bb')).toEqual({ tonicPc: 10, mode: 'major' })
    expect(parseKeyName('F#')).toEqual({ tonicPc: 6, mode: 'major' })
    expect(parseKeyName('C')).toEqual({ tonicPc: 0, mode: 'major' })
  })

  it('reads the m suffix as minor', () => {
    expect(parseKeyName('Ebm')).toEqual({ tonicPc: 3, mode: 'minor' })
    expect(parseKeyName('Am')).toEqual({ tonicPc: 9, mode: 'minor' })
  })

  it('tolerates surrounding spaces and unicode accidentals', () => {
    expect(parseKeyName(' B♭m ')).toEqual({ tonicPc: 10, mode: 'minor' })
  })

  it('rejects text that names no key', () => {
    expect(parseKeyName('')).toBeUndefined()
    expect(parseKeyName('Do majeur')).toBeUndefined()
    expect(parseKeyName('Hm')).toBeUndefined()
  })

  it('property — round-trips every key through its own name', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),
        fc.constantFrom('major', 'minor'),
        (tonicPc, mode) => {
          const key = { tonicPc, mode } as const
          expect(parseKeyName(keyName(key))).toEqual(key)
        }
      )
    )
  })
})

describe('transposeKey', () => {
  it('moves the tonic, keeps the mode, wraps the octave', () => {
    expect(transposeKey({ tonicPc: 0, mode: 'major' }, 3)).toEqual({
      tonicPc: 3,
      mode: 'major'
    })
    expect(transposeKey({ tonicPc: 2, mode: 'minor' }, -4)).toEqual({
      tonicPc: 10,
      mode: 'minor'
    })
  })
})
