import { describe, expect, it } from 'vitest'
import type { DetectedChordSpan } from '../domain/chord-detection.ts'
import { meteredGrid } from '../domain/metered-grid-fixture.ts'
import type { BeatGrid } from '../domain/tempo.ts'
import { ChordDetectionError, detectChords } from './detect-chords.ts'
import type { ChordDetector, DecodedAudio } from './ports.ts'

const audio: DecodedAudio = { sampleRate: 4, channels: [[0, 1, -1, 0.5]] }

/** A four-beat bar grid: downbeats every 2s, beats every 0.5s. */
function grid4(bars: number): BeatGrid {
  return Array.from({ length: bars * 4 }, (_, index) => ({
    timeSeconds: index * 0.5,
    downbeat: index % 4 === 0
  }))
}

/** One span per measure of `grid`, holding `labels[i]` over the i-th bar. */
function spansPerMeasure(
  labels: readonly string[],
  grid: BeatGrid
): readonly DetectedChordSpan[] {
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  return labels.map((label, index) => ({
    startSeconds: downbeats[index] as number,
    endSeconds: downbeats[index + 1] ?? (downbeats[index] as number) + 2,
    label
  }))
}

/** Fake detector: returns fixed spans, recording the audio it was handed. */
function fakeDetector(
  spans: readonly DetectedChordSpan[]
): ChordDetector & { seen: DecodedAudio | undefined } {
  const state = { seen: undefined as DecodedAudio | undefined }
  return {
    async detect(given) {
      state.seen = given
      return spans
    },
    get seen() {
      return state.seen
    }
  }
}

/** A draft's grid rows, without the leading detected-key and time-signature
    directive lines — each head is asserted in its own dedicated tests below. */
function grid(source: string): string {
  return source.replace(/^\{key:[^}]*\}\n/, '').replace(/^\{time:[^}]*\}\n/, '')
}

describe('detectChords', () => {
  it('drafts one chord per measure as grid source rows', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'Am' },
      { startSeconds: 4, endSeconds: 6, label: 'F' },
      { startSeconds: 6, endSeconds: 8, label: 'G' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(4), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('| C | Am | F | G |')
  })

  it('detects a flat key and spells the draft with flats under a key head', async () => {
    // A flat-key progression the engine spelled with sharps (Bb → A#, Eb → D#).
    const flatKey = ['F', 'A#', 'C', 'Dm', 'F', 'A#', 'D#', 'C']
    const spans: readonly DetectedChordSpan[] = flatKey.map((label, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 2,
      label
    }))
    const result = await detectChords(
      { audio, grid: grid4(8), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source.startsWith('{key: ')).toBe(true)
    expect(result.source).toContain('Bb')
    expect(result.source).toContain('Eb')
    expect(result.source).not.toContain('A#')
    expect(result.source).not.toContain('D#')
  })

  it('names the detected key even when the chords carry no accidentals', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'Am' },
      { startSeconds: 4, endSeconds: 6, label: 'F' },
      { startSeconds: 6, endSeconds: 8, label: 'G' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(4), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source.startsWith('{key: ')).toBe(true)
    // Natural chords are untouched — respelling a sharp key is a no-op.
    expect(grid(result.source)).toBe('| C | Am | F | G |')
  })

  it('wraps rows at four measures per row', async () => {
    const spans: readonly DetectedChordSpan[] = Array.from(
      { length: 5 },
      (_, index) => ({
        startSeconds: index * 2,
        endSeconds: index * 2 + 2,
        label: index % 2 === 0 ? 'C' : 'G'
      })
    )
    const result = await detectChords(
      { audio, grid: grid4(5), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('| C | G | C | G |\n| C |')
  })

  it('wraps the draft at the given bars-per-row', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'Am' },
      { startSeconds: 4, endSeconds: 6, label: 'F' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(3), barsPerRow: 2 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('| C | Am |\n| F |')
  })

  it('folds a progression detected twice in a row into repeat bars', async () => {
    const twice = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']
    const spans: readonly DetectedChordSpan[] = twice.map((label, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 2,
      label
    }))
    const result = await detectChords(
      { audio, grid: grid4(8), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('|: C | Am | F | G :|')
  })

  it('cuts and heads the draft by already-known sections instead of deducing', async () => {
    // The same progression twice would deduce into repeat bars under neutral
    // headers — but a structure detection already ran, so the draft must be
    // cut at ITS boundaries and headed with ITS names (display copy, printed
    // verbatim like the relabel path). The detected-key head stays.
    const twice = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']
    const spans: readonly DetectedChordSpan[] = twice.map((label, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 2,
      label
    }))
    const result = await detectChords(
      {
        audio,
        grid: grid4(8),
        barsPerRow: 4,
        sections: [
          { startSeconds: 0, endSeconds: 8, label: 'Couplet' },
          { startSeconds: 8, endSeconds: 16, label: 'Refrain' }
        ]
      },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe(
      '[Couplet]\n| C | Am | F | G |\n\n[Refrain]\n| C | Am | F | G |'
    )
    expect(result.source.startsWith('{key: ')).toBe(true)
  })

  it('heads a LONE known section — its marker must survive the sync', async () => {
    // Deduction suppresses the header of a single whole-song run (it names
    // nothing), but a KNOWN section is the timeline's structure: without the
    // header, the seated draft's chart→marker sync would derive no anchor and
    // erase the last structure marker.
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'G' }
    ]
    const result = await detectChords(
      {
        audio,
        grid: grid4(2),
        barsPerRow: 4,
        sections: [{ startSeconds: 0, endSeconds: 4, label: 'Couplet' }]
      },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('[Couplet]\n| C | G |')
  })

  it('deduces the structure when the known sections are empty', async () => {
    const twice = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']
    const spans: readonly DetectedChordSpan[] = twice.map((label, index) => ({
      startSeconds: index * 2,
      endSeconds: index * 2 + 2,
      label
    }))
    const result = await detectChords(
      { audio, grid: grid4(8), barsPerRow: 4, sections: [] },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('|: C | Am | F | G :|')
  })

  it('heads the draft with the dominant time signature and marks meter changes', async () => {
    // Four-beat bars with ONE two-beat bar (The Logical Song's 2/4 turnaround):
    // the draft names the dominant 4/4 up front and marks the change in-grid.
    const grid = meteredGrid([4, 4, 2, 4, 4])
    const spans = spansPerMeasure(['C', 'Am', 'F', 'G', 'C'], grid)
    const result = await detectChords(
      { audio, grid, barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe(
      [
        '{key: C}',
        '{time: 4/4}',
        '| C | Am |',
        '{time: 2/4}',
        '| F |',
        '{time: 4/4}',
        '| G | C |'
      ].join('\n')
    )
  })

  it('never lets a short first bar collide with the {time:} head', async () => {
    // A pickup-length first interval (a common artifact at track start) must
    // NOT print a lead {time: 2/4} line above the grid — parseChart would
    // read it as a second head directive and drop the dominant.
    const pickupGrid = meteredGrid([2, 4, 4, 4])
    const spans = spansPerMeasure(['C', 'Am', 'F', 'G'], pickupGrid)
    const result = await detectChords(
      { audio, grid: pickupGrid, barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(grid(result.source)).toBe('| C | Am | F | G |')
    expect(result.source).toContain('{time: 4/4}')
    expect(result.source).not.toContain('{time: 2/4}')
  })

  it('prints the felt meter, not the doubled density of a folded grid', async () => {
    // After an octave ×2 fold every downbeat interval counts twice the felt
    // bar; the session's beatsPerBar is the authority the head prints, and
    // the 2/4 turnaround still marks as 2/4 — never 4/8.
    const grid = meteredGrid([8, 8, 4, 8, 8], 0.25)
    const spans = spansPerMeasure(['C', 'Am', 'F', 'G', 'C'], grid)
    const result = await detectChords(
      { audio, grid, barsPerRow: 4, beatsPerBar: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe(
      [
        '{key: C}',
        '{time: 4/4}',
        '| C | Am |',
        '{time: 2/4}',
        '| F |',
        '{time: 4/4}',
        '| G | C |'
      ].join('\n')
    )
  })

  it('writes no meter change on a steady grid', async () => {
    const spans: readonly DetectedChordSpan[] = [
      { startSeconds: 0, endSeconds: 2, label: 'C' },
      { startSeconds: 2, endSeconds: 4, label: 'G' }
    ]
    const result = await detectChords(
      { audio, grid: grid4(2), barsPerRow: 4 },
      { detector: fakeDetector(spans) }
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.source).toBe('{key: C}\n{time: 4/4}\n| C | G |')
  })

  it('rejects a detection carrying non-finite times', async () => {
    const result = await detectChords(
      { audio, grid: grid4(2), barsPerRow: 4 },
      {
        detector: fakeDetector([
          // A clean span first: ONE corrupt span must poison the whole batch.
          { startSeconds: 0, endSeconds: 2, label: 'C' },
          { startSeconds: 2, endSeconds: Number.NaN, label: 'G' }
        ])
      }
    )
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'invalid chord detection'
    })
  })

  it('hands the detector the same PCM it was given', async () => {
    const detector = fakeDetector([])
    await detectChords({ audio, grid: grid4(1), barsPerRow: 4 }, { detector })
    expect(detector.seen).toBe(audio)
  })

  it('hands the caller abort signal through to the detector', async () => {
    let seenSignal: AbortSignal | undefined
    const detector: ChordDetector = {
      async detect(_given, signal) {
        seenSignal = signal
        return []
      }
    }
    const controller = new AbortController()
    await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4, signal: controller.signal },
      { detector }
    )
    expect(seenSignal).toBe(controller.signal)
  })

  it('rejects a grid without downbeats before calling the detector', async () => {
    const detector = fakeDetector([
      { startSeconds: 0, endSeconds: 2, label: 'C' }
    ])
    const result = await detectChords(
      { audio, grid: [{ timeSeconds: 0, downbeat: false }], barsPerRow: 4 },
      { detector }
    )
    expect(result).toEqual({
      ok: false,
      code: 'no-downbeat',
      detail: 'no downbeat to anchor measures on'
    })
    expect(detector.seen).toBeUndefined()
  })

  it('returns an error result when the detector reports nothing', async () => {
    const result = await detectChords(
      { audio, grid: grid4(2), barsPerRow: 4 },
      { detector: fakeDetector([]) }
    )
    expect(result).toEqual({
      ok: false,
      code: 'no-chords',
      detail: 'no chords detected'
    })
  })

  it('folds an untyped detector throw into the unknown code', async () => {
    const boom: ChordDetector = {
      detect: async () => {
        throw new Error('chord engine down')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: boom }
    )
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'chord engine down'
    })
  })

  it('carries the code of a typed ChordDetectionError through', async () => {
    const down: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('engine-unavailable', 'HTTP 503')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: down }
    )
    expect(result).toEqual({
      ok: false,
      code: 'engine-unavailable',
      detail: 'HTTP 503'
    })
  })

  it('carries a timeout ChordDetectionError code through', async () => {
    const slow: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('timeout', 'HTTP 504')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: slow }
    )
    expect(result).toEqual({ ok: false, code: 'timeout', detail: 'HTTP 504' })
  })

  it('carries a too-large ChordDetectionError code through', async () => {
    const heavy: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('too-large', 'HTTP 413')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: heavy }
    )
    expect(result).toEqual({ ok: false, code: 'too-large', detail: 'HTTP 413' })
  })

  it('carries a network ChordDetectionError code through', async () => {
    const offline: ChordDetector = {
      detect: async () => {
        throw new ChordDetectionError('network', 'Failed to fetch')
      }
    }
    const result = await detectChords(
      { audio, grid: grid4(1), barsPerRow: 4 },
      { detector: offline }
    )
    expect(result).toEqual({
      ok: false,
      code: 'network',
      detail: 'Failed to fetch'
    })
  })
})
