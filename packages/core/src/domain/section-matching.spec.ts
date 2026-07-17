import { describe, expect, it } from 'vitest'
import { blockSimilarity, matchesTolerantly } from './section-matching.ts'

describe('blockSimilarity', () => {
  it('identical blocks agree fully', () => {
    expect(blockSimilarity(['C', 'F'], ['C', 'F']).ratio).toBe(1)
  })

  it('lists the positions that genuinely differ', () => {
    expect(
      blockSimilarity(['C', 'Am', 'F', 'G'], ['C', 'E7', 'F', 'D']).differing
    ).toEqual([1, 3])
  })

  it('a difference in the last two bars weighs half a body difference', () => {
    // 6 bars, diffs on the last two: agreement 4 over evidence 4+2·0.5 = 0.8.
    const a = ['C', 'Am', 'F', 'G', 'Dm', 'G7']
    const b = ['C', 'Am', 'F', 'G', 'C', 'C']
    expect(blockSimilarity(a, b).ratio).toBeCloseTo(0.8)
  })

  it('a body difference keeps its full weight', () => {
    // Same two diffs moved to the head: agreement 4 over evidence 2+2+1 = 0.6.
    const a = ['Dm', 'G7', 'C', 'Am', 'F', 'G']
    const b = ['C', 'C', 'C', 'Am', 'F', 'G']
    expect(blockSimilarity(a, b).ratio).toBeCloseTo(0.6)
  })

  it('blank-vs-blank carries no evidence either way', () => {
    const a = [undefined, 'C', undefined, 'G']
    const b = [undefined, 'C', undefined, 'G']
    expect(blockSimilarity(a, b).ratio).toBe(1)
  })

  it('a bar detected on one side only is a disagreement', () => {
    expect(blockSimilarity(['C', 'F'], ['C', undefined]).differing).toEqual([1])
  })

  it('agreement on the downbeat chord of a split cell is agreement', () => {
    expect(blockSimilarity(['F'], ['F G']).ratio).toBe(1)
  })

  it('two all-silent blocks are the same block — nothing disproves it', () => {
    expect(
      blockSimilarity([undefined, undefined], [undefined, undefined]).ratio
    ).toBe(1)
  })

  it('flags tail-only differences', () => {
    const a = ['C', 'Am', 'F', 'G', 'Dm', 'G7']
    const b = ['C', 'Am', 'F', 'G', 'C', 'C']
    expect(blockSimilarity(a, b).tailOnly).toBe(true)
  })

  it('a body difference is never tail-only', () => {
    const a = ['C', 'Am', 'F', 'G', 'Dm', 'G7']
    const b = ['C', 'E7', 'F', 'G', 'Dm', 'C']
    expect(blockSimilarity(a, b).tailOnly).toBe(false)
  })
})

describe('matchesTolerantly', () => {
  it('groups blocks that differ only on their last two bars', () => {
    const a = ['C', 'Am', 'F', 'G', 'Dm', 'G7']
    const b = ['C', 'Am', 'F', 'G', 'C', 'C']
    expect(matchesTolerantly(a, b)).toBe(true)
  })

  it('refuses the same two differences at the head', () => {
    const a = ['Dm', 'G7', 'C', 'Am', 'F', 'G']
    const b = ['C', 'C', 'C', 'Am', 'F', 'G']
    expect(matchesTolerantly(a, b)).toBe(false)
  })

  it('unequal lengths never match — a tail is not a section', () => {
    expect(matchesTolerantly(['C', 'F', 'G'], ['C', 'F'])).toBe(false)
  })

  it('still matches at exactly the threshold', () => {
    // 8 bars, one body diff and one tail diff: 5.5 of 7 ≈ 0.786 ≥ 0.75.
    const a = ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G7']
    const b = ['C', 'Am', 'F', 'G', 'Em', 'A7', 'Dm', 'E7']
    expect(matchesTolerantly(a, b)).toBe(true)
  })
})
