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

describe('encodeChartSource — rollout and meters', () => {
  const cycleWithShortBar = [
    '| C | Am | F | G |',
    '{time: 2/4}',
    '| Em |',
    '{time: 4/4}',
    '| Am | Dm | G7 |'
  ].join('\n')

  it('a returning mid-cycle meter change rides the rollout', () => {
    // The voted cycle meters print inside the rolled body: losing them would
    // silently re-time every pass of the form.
    const meters = [4, 4, 4, 4, 2, 4, 4, 4]
    const song = [...CHORUS, ...CHORUS, ...CHORUS]
    expect(
      encodeChartSource(song, [...meters, ...meters, ...meters], 4, 4)
    ).toEqual({ source: cycleWithShortBar, rollout: 3 })
  })

  it('an unknown opening meter enters the cycle at the running one', () => {
    // meters[0] undefined: the walk enters at initialMeter — a broken entry
    // would refuse a perfectly returning cycle.
    const meters = [undefined, 4, 4, 4, 2, 4, 4, 4]
    const song = [...CHORUS, ...CHORUS, ...CHORUS]
    expect(
      encodeChartSource(song, [...meters, ...meters, ...meters], 4, 4)
    ).toEqual({ source: cycleWithShortBar, rollout: 3 })
  })

  it('a cycle whose meter does not return refuses the rollout', () => {
    // Each pass ends in 3/4 while the next re-opens in 4/4: rolling that out
    // would re-time pass 2..N — the song must print flat instead.
    const meters = [4, 4, 4, 4, 4, 4, 3, 3]
    const song = [...CHORUS, ...CHORUS, ...CHORUS]
    const encoded = encodeChartSource(
      song,
      [...meters, ...meters, ...meters],
      4,
      4
    )
    expect(encoded.rollout).toBeUndefined()
    expect(encoded.source.includes('|:')).toBe(false)
  })
})

describe('encodeChartSource — voltas and meters', () => {
  const VARIANT = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'E7']
  /** One 8-bar pass with a returning 3/4 bar — steady is false, so the
      volta bracket is off the table and folds must carry the form. */
  const CHANGING = [4, 4, 3, 4, 4, 4, 4, 4]
  const foldedChorus = (ending: string, close: string) =>
    [
      '|: C | Am |',
      '{time: 3/4}',
      '| F |',
      '{time: 4/4}',
      '| G | Em | Am | Dm |',
      `| ${ending} ${close}`
    ].join('\n')

  it('steady meters keep the volta bracket', () => {
    const out = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'C', 'C']
    const song = [...CHORUS, ...out]
    expect(encodeChartSource(song, Array(16).fill(4), 4, 4).source).toBe(
      '|: C | Am | F | G |\n| Em | Am |\n|1. Dm | G7 :|\n|2. C | C |'
    )
  })

  it('an in-block meter change refuses the volta and folds the clean pair', () => {
    // P P P': no volta (meters not steady), so the clean pair folds and the
    // variant pass prints faithfully — its own bars, not the type vote.
    const song = [...CHORUS, ...CHORUS, ...VARIANT]
    const meters = [...CHANGING, ...CHANGING, ...CHANGING]
    expect(encodeChartSource(song, meters, 4, 4).source).toBe(
      `[A]\n${foldedChorus('G7', ':|')}\n\n[A]\n${foldedChorus('E7', '|').replace('|:', '|')}`
    )
  })

  it('an unknown bar meter is steady — the volta bracket stays', () => {
    // A hole in the section meters (one bar the grid could not time) is not
    // a meter CHANGE: it inherits the running meter, so the volta is legal.
    const out = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'C', 'C']
    const song = [...CHORUS, ...out]
    const meters = Array(16).fill(4)
    meters[3] = undefined
    meters[11] = undefined
    expect(encodeChartSource(song, meters, 4, 4).source).toBe(
      '|: C | Am | F | G |\n| Em | Am |\n|1. Dm | G7 :|\n|2. C | C |'
    )
  })

  it('a fold votes only over the passes it folds', () => {
    // P P P' P' P': the head pair folds with ITS ending (G7) even though the
    // variant ending (E7) wins the type-wide vote 3 to 2 — a fold that voted
    // across the whole type would rewrite history.
    const song = [...CHORUS, ...CHORUS, ...VARIANT, ...VARIANT, ...VARIANT]
    const meters = Array.from({ length: 5 }, () => CHANGING).flat()
    expect(encodeChartSource(song, meters, 4, 4).source).toBe(
      `[A]\n${foldedChorus('G7', ':|')}\n\n[A]\n${foldedChorus('E7', ':| x3')}`
    )
  })
})

describe('encodeChartSource — plan rendering', () => {
  it('a cost tie keeps plain writing over the volta bracket', () => {
    // Two 4-bar passes differing at the last bar: volta (3 body + 2 endings,
    // nav 3) and plain writing (8 bars, nav 0) cost the same — the
    // navigation tie-break keeps the plain rows, and the faithful print
    // keeps each pass's own ending.
    const song = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'E7']
    expect(encodeChartSource(song, undefined, 4).source).toBe(
      '| C | Am | F | G |\n| C | Am | F | E7 |'
    )
  })

  it('a section in a new meter gets its lead line before the header', () => {
    // A A B with B in 3/4: the {time:} lead prints ABOVE [B] — a signature
    // change at a section boundary, not inside the block.
    const a = bars('C').slice(0, 8)
    const b = bars('F').slice(0, 8)
    const song = [...a, ...a, ...b]
    const meters = [...Array(16).fill(4), ...Array(8).fill(3)]
    expect(encodeChartSource(song, meters, 4, 4).source).toBe(
      [
        '[A]',
        '|: C0m0 | C1m1 | C2m2 | C3m3 |',
        '| C4m4 | C5m5 | C6m6 | C7m7 :|',
        '',
        '{time: 3/4}',
        '[B]',
        '| F0m0 | F1m1 | F2m2 | F3m3 |',
        '| F4m4 | F5m5 | F6m6 | F7m7 |'
      ].join('\n')
    )
  })

  it('with no running meter the head block prints no lead line', () => {
    // Same song as above but WITHOUT an initial meter: the head block's 4/4
    // is adopted silently (the head names the meter, it is not a change) —
    // only the genuine 3/4 boundary prints a lead.
    const a = bars('C').slice(0, 8)
    const b = bars('F').slice(0, 8)
    const song = [...a, ...a, ...b]
    const meters = [...Array(16).fill(4), ...Array(8).fill(3)]
    const { source } = encodeChartSource(song, meters, 4)
    expect(source.startsWith('[A]\n|: C0m0')).toBe(true)
    expect(source).toContain('{time: 3/4}\n[B]')
  })

  it('never folds tolerant-but-unequal passes into repeat bars', () => {
    // A clean 3× cycle of a 7-bar section (+ a 4-bar intro): 7 is no tiling
    // length, so the MDL tiles by 4 and the 4-bar blocks match only
    // TOLERANTLY. Folding them into `|: :|` would replay one copy and drop
    // the bars where they differ — the unroll oracle's shrunk counterexample.
    const labels = [
      'Db',
      'Db',
      'Db',
      'Db',
      'Em',
      'Em',
      'Em',
      'Em',
      'G',
      'G',
      'Em',
      'Em',
      'Em',
      'Em',
      'Em',
      'G',
      'G',
      'Em',
      'Em',
      'Em',
      'Em',
      'Em',
      'G',
      'G',
      'Em'
    ]
    const { source, rollout } = encodeChartSource(labels, undefined, 2)
    const full =
      rollout === undefined ? source : `{form: ${rollout}x}\n${source}`
    expect(playedLabels(full)).toEqual(labels)
  })

  it('a non-returning section restates its meter across written copies', () => {
    // X P P where P ends in 3/4: the pair cannot fold (the second copy needs
    // a {time: 4/4} restatement), so ONE run block writes both copies — and
    // only the measures inside the range (never the whole song).
    const x = bars('X').slice(0, 8)
    const p = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const mp = [4, 4, 4, 4, 4, 4, 3, 3]
    const song = [...x, ...p, ...p]
    const meters = [...Array(8).fill(4), ...mp, ...mp]
    const pRows = [
      '| C | Am | F | G |',
      '| Em | Am |',
      '{time: 3/4}',
      '| Dm | G7 |'
    ]
    expect(encodeChartSource(song, meters, 4, 4).source).toBe(
      [
        '[A]',
        '| X0m0 | X1m1 | X2m2 | X3m3 |',
        '| X4m4 | X5m5 | X6m6 | X7m7 |',
        '',
        '[B]',
        ...pRows,
        '{time: 4/4}',
        ...pRows
      ].join('\n')
    )
  })
})

/** 16-bar sections that no shorter tiling explains. */
const bars = (seed: string) =>
  Array.from({ length: 16 }, (_, index) => `${seed}${index % 8}m${index}`)

/** The 4-per-row rows a 16-bar `bars(seed)` section prints. */
const barsRows = (seed: string) =>
  [
    `| ${seed}0m0 | ${seed}1m1 | ${seed}2m2 | ${seed}3m3 |`,
    `| ${seed}4m4 | ${seed}5m5 | ${seed}6m6 | ${seed}7m7 |`,
    `| ${seed}0m8 | ${seed}1m9 | ${seed}2m10 | ${seed}3m11 |`,
    `| ${seed}4m12 | ${seed}5m13 | ${seed}6m14 | ${seed}7m15 |`
  ].join('\n')

describe('encodeChartSource — da capo', () => {
  const a = bars('C')
  const b = bars('F')

  it('a head-out form replays through a D.C. — exact print order', () => {
    // Pins the whole render: the fine closes the REPLAYED prefix (block 1),
    // headers appear on every block, and the D.C. is the closing line.
    const song = [...a, ...b, ...a]
    expect(encodeChartSource(song, undefined, 4).source).toBe(
      `[A]\n${barsRows('C')}\n{fine}\n\n[B]\n${barsRows('F')}\n{d.c.}`
    )
  })

  it('a strophe pair replays whole — D.C. without a fine', () => {
    // replayed === dcAt: the whole written form replays, so no fine is
    // printed (a fine after the last block would be the plain end).
    const song = [...a, ...b, ...a, ...b]
    const { source } = encodeChartSource(song, undefined, 4)
    expect(source).toBe(
      `[A]\n${barsRows('C')}\n\n[B]\n${barsRows('F')}\n{d.c.}`
    )
    expect(playedLabels(source)).toEqual(song)
  })

  it('a three-section replay aligns every pair, not just the ends', () => {
    // ABCABC: the replay check must compare position i with i (a reversed
    // walk would match [1] against [1] and accept the wrong alignment).
    const song = [...a, ...b, ...bars('G'), ...a, ...b, ...bars('G')]
    const { source } = encodeChartSource(song, undefined, 4)
    expect(source).toContain('{d.c.}')
    expect(playedLabels(source)).toEqual(song)
  })

  it('trailing copies fold into a pass count instead of a D.C.', () => {
    // a b a a a a: folding the four As (|: :| x4) beats replaying via D.C. —
    // and the run scan must stop at the range edge either way.
    const song = [...a, ...b, ...a, ...a, ...a, ...a]
    const { source } = encodeChartSource(song, undefined, 4)
    expect(source).toContain(':| x4')
    expect(playedLabels(source)).toEqual(song)
  })

  it('a passe that differs anywhere prints faithfully — playback stays exact', () => {
    // A B A' B A with one mis-detected bar in the MIDDLE A: the A passes are
    // no longer byte-identical, so the type prints FAITHFULLY (each pass its
    // own bars) rather than collapsing to a vote. Playback must equal the
    // detection exactly — voting one pass's bar away would break the unroll
    // oracle (repeat bars replay a single copy verbatim).
    const noisy = [...a]
    noisy[5] = 'Zz'
    const song = [...a, ...b, ...noisy, ...b, ...a]
    const { source } = encodeChartSource(song, undefined, 4)
    expect(playedLabels(source)).toEqual(song)
  })

  it('a one-bar pair stays plain (AI.2)', () => {
    // Too short for any tiling: the song is unstructured and must take the
    // flat fallback verbatim. (The DP cost/tie-break pins live in the
    // 'plan rendering' describe — this song never reaches the planner.)
    expect(encodeChartSource(['C', 'C'], undefined, 4).source).toBe('| C | C |')
  })

  it('plans each range on its own — distinct sections never share a memo entry (AI.2)', () => {
    // Five instances over three section types: the DP solves several
    // distinct (from, to) subproblems. A degenerate memo key (every range
    // colliding on one entry) would replay the wrong range's plan and break
    // the playback — the survivor Stryker flagged on the key template.
    const song = [
      ...bars('C'),
      ...bars('C'),
      ...bars('F'),
      ...bars('F'),
      ...bars('G')
    ]
    const { source } = encodeChartSource(song, undefined, 4)
    expect(playedLabels(source)).toEqual(song)
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
