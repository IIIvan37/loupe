import { describe, expect, it } from 'vitest'
import { applyBassSlash, bassNotePerMeasure } from './bass-line.ts'

const SR = 44100

/** A mono signal of per-measure sines: `hzPerMeasure[i]` fills measure i
 * (1 s each), 0 = silence. */
function bassOf(hzPerMeasure: readonly number[]): Float32Array {
  const samples = new Float32Array(hzPerMeasure.length * SR)
  hzPerMeasure.forEach((hz, measure) => {
    if (hz === 0) {
      return
    }
    for (let i = 0; i < SR; i++) {
      samples[measure * SR + i] = 0.8 * Math.sin((2 * Math.PI * hz * i) / SR)
    }
  })
  return samples
}

/** One downbeat per second, one MEASURE per downbeat — the same convention
 * as `chordLabelPerMeasure` (the last bar extends by the previous bar's
 * length), so `applyBassSlash` sees rows of equal length. */
function gridOf(measures: number) {
  return Array.from({ length: measures }, (_, i) => ({
    timeSeconds: i,
    downbeat: true
  }))
}

describe('bassNotePerMeasure', () => {
  it('names the dominant low note of each measure', () => {
    // E1 (41.2 Hz) then A1 (55 Hz): classes E (4) and A (9).
    const notes = bassNotePerMeasure(bassOf([41.2, 55]), SR, gridOf(2))
    expect(notes).toEqual([4, 9])
  })

  it('reads nothing from a silent measure', () => {
    const notes = bassNotePerMeasure(bassOf([41.2, 0]), SR, gridOf(2))
    expect(notes).toEqual([4, undefined])
  })

  it('reads nothing from an empty grid', () => {
    expect(bassNotePerMeasure(bassOf([41.2]), SR, [])).toEqual([])
  })

  it('hears the LAST measure too — one note per downbeat, like the labels', () => {
    // Two downbeats, two measures: the closing bar has no closing downbeat
    // (it extends by the previous bar's length, chordLabelPerMeasure's
    // convention) — its bass must still be read, or the final measure of
    // every song silently never prints a slash.
    const grid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 1, downbeat: true }
    ]
    expect(bassNotePerMeasure(bassOf([41.2, 55]), SR, grid)).toEqual([4, 9])
  })

  it('a lone downbeat opens one measure, read to the end of the signal', () => {
    expect(
      bassNotePerMeasure(bassOf([55]), SR, [{ timeSeconds: 0, downbeat: true }])
    ).toEqual([9])
  })

  it('only downbeats bound measures — plain beats never cut', () => {
    // Four beats per 1 s measure: still ONE note per measure, not four.
    const grid = Array.from({ length: 8 }, (_, i) => ({
      timeSeconds: i * 0.25,
      downbeat: i % 4 === 0
    }))
    expect(bassNotePerMeasure(bassOf([41.2, 55]), SR, grid)).toEqual([4, 9])
  })

  it('a harmonic above the bass register never contests the note', () => {
    // A2 (110 Hz) with a LOUD 3rd partial (330 Hz — over the 262 Hz roof):
    // the register cap keeps the read-out on the played bass.
    const samples = new Float32Array(SR)
    for (let i = 0; i < SR; i++) {
      samples[i] =
        0.5 * Math.sin((2 * Math.PI * 110 * i) / SR) +
        0.9 * Math.sin((2 * Math.PI * 330 * i) / SR)
    }
    expect(bassNotePerMeasure(samples, SR, gridOf(1))).toEqual([9])
  })

  it('names an off-bin note by its interpolated frequency, not its bin', () => {
    // 47.4 Hz (F#1 +42c): the raw peak bin centre (48.45 Hz) reads G — only
    // the parabolic refinement lands the true class.
    expect(bassNotePerMeasure(bassOf([47.4]), SR, gridOf(1))).toEqual([6])
  })

  it('hears a note played late in a long measure — windows span the bar', () => {
    // 3 s measure: soft A1 for 2 s, then loud E1. Only the windows spread
    // across the bar reach the louder late note; a single window at the
    // downbeat would misread the measure as A.
    const samples = new Float32Array(3 * SR)
    for (let i = 0; i < 2 * SR; i++) {
      samples[i] = 0.2 * Math.sin((2 * Math.PI * 55 * i) / SR)
    }
    for (let i = 2 * SR; i < 3 * SR; i++) {
      samples[i] = 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / SR)
    }
    const grid = [
      { timeSeconds: 0, downbeat: true },
      { timeSeconds: 3, downbeat: true }
    ]
    expect(bassNotePerMeasure(samples, SR, grid).at(0)).toBe(4)
  })

  it('an ambiguous measure (two competing notes) stays blank', () => {
    // E1 and A1 at equal strength in the same measure: no stable bass.
    const samples = new Float32Array(SR)
    for (let i = 0; i < SR; i++) {
      samples[i] =
        0.4 * Math.sin((2 * Math.PI * 41.2 * i) / SR) +
        0.4 * Math.sin((2 * Math.PI * 55 * i) / SR)
    }
    expect(bassNotePerMeasure(samples, SR, gridOf(1))).toEqual([undefined])
  })
})

describe('applyBassSlash', () => {
  it('slashes a chord whose stable bass is not its root', () => {
    expect(applyBassSlash(['C', 'G'], [4, 7])).toEqual(['C/E', 'G'])
  })

  it('leaves the plain chord when the bass IS the root', () => {
    expect(applyBassSlash(['Am'], [9])).toEqual(['Am'])
  })

  it('leaves a measure with no stable bass untouched', () => {
    expect(applyBassSlash(['C'], [undefined])).toEqual(['C'])
  })

  it('never slashes a two-chord measure — whose bass would it be?', () => {
    expect(applyBassSlash(['C G'], [4])).toEqual(['C G'])
  })

  it('spells the bass with sharps — the key respell downstream owns flats', () => {
    expect(applyBassSlash(['B'], [6])).toEqual(['B/F#'])
  })

  it('keeps silence and structural tokens untouched', () => {
    expect(applyBassSlash(['N.C.'], [4])).toEqual(['N.C.'])
  })

  it('ignores a missing bass row (shorter than the labels)', () => {
    expect(applyBassSlash(['C', 'F'], [4])).toEqual(['C/E', 'F'])
  })

  it('leaves an empty measure (no chord heard) empty', () => {
    expect(applyBassSlash([undefined, 'C'], [4, 4])).toEqual([undefined, 'C/E'])
  })
})
