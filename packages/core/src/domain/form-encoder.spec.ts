import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  deduceStructure,
  playedLabels,
  renderStructuredSource
} from './chart-structure.ts'
import { encodeChartSource } from './form-encoder.ts'

/** A 4-bar phrase and an 8-bar chorus shared by the calibration cases. */
const PHRASE = ['C', 'Am', 'F', 'G']
const CHORUS = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']

describe('encodeChartSource — calibration', () => {
  it('folds a pair into repeat bars, exactly as before', () => {
    expect(encodeChartSource([...PHRASE, ...PHRASE], undefined, 4).source).toBe(
      '|: C | Am | F | G :|'
    )
  })

  it('a run of three earns a pass count, not three copies', () => {
    const song = [...PHRASE, ...PHRASE, ...PHRASE]
    expect(encodeChartSource(song, undefined, 4).source).toBe(
      '|: C | Am | F | G :| x3'
    )
  })

  it('two passes differing at the end print as voltas', () => {
    const out = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'C', 'C']
    const song = [...CHORUS, ...out]
    expect(encodeChartSource(song, undefined, 4).source).toBe(
      '|: C | Am | F | G |\n| Em | Am |\n|1. Dm | G7 :|\n|2. C | C |'
    )
  })

  it('three identical choruses become one cycle with a rollout', () => {
    const song = [...CHORUS, ...CHORUS, ...CHORUS]
    expect(encodeChartSource(song, undefined, 4)).toEqual({
      source: '| C | Am | F | G |\n| Em | Am | Dm | G7 |',
      rollout: 3
    })
  })

  it('two choruses stay repeat bars — a rollout of two says less', () => {
    const song = [...CHORUS, ...CHORUS]
    expect(encodeChartSource(song, undefined, 4).source).toBe(
      '|: C | Am | F | G |\n| Em | Am | Dm | G7 :|'
    )
  })

  it('a chorus run plus an outro keeps the count inside the grid', () => {
    const outro = ['F', 'C', 'F', 'C']
    const song = [...CHORUS, ...CHORUS, ...CHORUS, ...outro]
    expect(encodeChartSource(song, undefined, 4).source).toContain(':| x3')
  })

  it('a non-returning meter change forbids any fold', () => {
    const meters = [4, 4, 4, 3, 4, 4, 4, 3]
    const song = [...PHRASE, ...PHRASE]
    expect(encodeChartSource(song, meters, 4, 4).source.includes('|:')).toBe(
      false
    )
  })
})

describe('encodeChartSource — da capo', () => {
  /** 16-bar sections that no shorter tiling explains. */
  const bars = (seed: string) =>
    Array.from({ length: 16 }, (_, index) => `${seed}${index % 8}m${index}`)
  const a = bars('C')
  const b = bars('F')

  it('a head-out form replays through a D.C. with a fine', () => {
    const song = [...a, ...b, ...a]
    expect(encodeChartSource(song, undefined, 4).source).toContain('{d.c.}')
  })

  it('the replayed pass ends at the fine', () => {
    const song = [...a, ...b, ...a]
    expect(encodeChartSource(song, undefined, 4).source).toContain('{fine}')
  })

  it('a D.C. that would only save a few bars never wins', () => {
    const shortA = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const shortB = ['F', 'G', 'Em', 'Am', 'Dm', 'G7', 'C', 'C']
    const song = [...shortA, ...shortB, ...shortA]
    expect(
      encodeChartSource(song, undefined, 4).source.includes('{d.c.}')
    ).toBe(false)
  })
})

describe('encodeChartSource — unroll oracle', () => {
  const chord = fc.constantFrom('C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bb', 'E7')
  // Intro, outro and the variant ending draw from alphabets DISJOINT from
  // the section's: the oracle pins exact playback of genuine structure.
  // Accidental near-matches exercise the DESIGNED tolerance (voting merges
  // them, as deduceStructure always has) and are pinned by the count
  // property below instead.
  const introChord = fc.constantFrom('Db', 'Ab')
  const outroChord = fc.constantFrom('F#m', 'B7')

  /** intro? + N × cycle + outro?, the last cycle pass optionally re-ended —
      every shape the encoder claims to handle. */
  const song = fc
    .record({
      section: fc.array(chord, { minLength: 4, maxLength: 8 }),
      copies: fc.integer({ min: 1, max: 4 }),
      intro: fc.option(fc.array(introChord, { minLength: 4, maxLength: 4 }), {
        nil: undefined
      }),
      outro: fc.option(fc.array(outroChord, { minLength: 2, maxLength: 4 }), {
        nil: undefined
      }),
      reEnded: fc.boolean()
    })
    .map(({ section, copies, intro, outro, reEnded }) => {
      const passes = Array.from({ length: copies }, () => [...section])
      const last = passes[passes.length - 1] as string[]
      if (reEnded) last[last.length - 1] = 'C#7'
      return [...(intro ?? []), ...passes.flat(), ...(outro ?? [])]
    })

  it('property — the rendered grid plays back exactly what was detected', () => {
    fc.assert(
      fc.property(song, fc.integer({ min: 2, max: 8 }), (labels, width) => {
        const { source, rollout } = encodeChartSource(labels, undefined, width)
        const full =
          rollout === undefined ? source : `{form: ${rollout}x}\n${source}`
        return JSON.stringify(playedLabels(full)) === JSON.stringify(labels)
      }),
      { numRuns: 300 }
    )
  })

  it('property — re-encoding its own playback is stable', () => {
    fc.assert(
      fc.property(song, (labels) => {
        const first = encodeChartSource(labels, undefined, 4)
        const firstFull =
          first.rollout === undefined
            ? first.source
            : `{form: ${first.rollout}x}\n${first.source}`
        const replayed = playedLabels(firstFull)
        const second = encodeChartSource(replayed, undefined, 4)
        const secondFull =
          second.rollout === undefined
            ? second.source
            : `{form: ${second.rollout}x}\n${second.source}`
        return (
          JSON.stringify(playedLabels(secondFull)) === JSON.stringify(replayed)
        )
      }),
      { numRuns: 150 }
    )
  })
})

describe('encodeChartSource — noise', () => {
  const chord = fc.constantFrom('C', 'Dm', 'Em', 'F', 'G', 'Am')

  it('property — a mis-detected bar never changes the played measure count', () => {
    const cleanSong = fc
      .record({
        section: fc.array(chord, { minLength: 4, maxLength: 8 }),
        copies: fc.integer({ min: 2, max: 4 })
      })
      .map(({ section, copies }) =>
        Array.from({ length: copies }, () => section).flat()
      )
    fc.assert(
      fc.property(cleanSong, fc.nat(), chord, (labels, position, wrong) => {
        const noisy = [...labels]
        noisy[position % noisy.length] = wrong
        const { source, rollout } = encodeChartSource(noisy, undefined, 4)
        const full =
          rollout === undefined ? source : `{form: ${rollout}x}\n${source}`
        return playedLabels(full).length === noisy.length
      }),
      { numRuns: 200 }
    )
  })
})

describe('encodeChartSource — fallback', () => {
  it('an unstructured song renders byte-identical to the flat render', () => {
    const labels = Array.from({ length: 14 }, (_, index) => `X${index}`)
    expect(encodeChartSource(labels, undefined, 4).source).toBe(
      renderStructuredSource(deduceStructure(labels), 4)
    )
  })

  it('the fallback keeps its meter marks byte-identical too', () => {
    const labels = Array.from({ length: 10 }, (_, index) => `X${index}`)
    const meters = [4, 4, 4, 2, 4, 4, 4, 4, 4, 4]
    expect(encodeChartSource(labels, meters, 4, 4).source).toBe(
      renderStructuredSource(deduceStructure(labels, meters), 4, 4)
    )
  })
})
