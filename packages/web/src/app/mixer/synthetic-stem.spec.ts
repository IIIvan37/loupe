import { describe, expect, it } from 'vitest'
import { METRONOME_ID } from '../tempo/metronome-stem.ts'
import { isSyntheticStem } from './synthetic-stem.ts'
import { TRACK_STEM_ID } from './track-stem.ts'

describe('isSyntheticStem', () => {
  it('flags the metronome and the un-split track lanes', () => {
    expect(isSyntheticStem(METRONOME_ID)).toBe(true)
    expect(isSyntheticStem(TRACK_STEM_ID)).toBe(true)
  })

  it('leaves a real separation stem alone', () => {
    expect(isSyntheticStem('vocals')).toBe(false)
    expect(isSyntheticStem('drums')).toBe(false)
  })
})
