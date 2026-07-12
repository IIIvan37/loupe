// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow,
  storeBarsPerRow
} from './bars-per-row-preference.ts'

describe('bars-per-row preference', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a stored layout', () => {
    storeBarsPerRow(6)
    expect(readStoredBarsPerRow()).toBe(6)
  })

  it('reads nothing when no preference was ever stored', () => {
    expect(readStoredBarsPerRow()).toBeUndefined()
  })

  it('never surfaces a value the layout cannot use', () => {
    localStorage.setItem('loupe.chords.bars-per-row', '99')
    expect(readStoredBarsPerRow()).toBeUndefined()
  })

  it('never surfaces a corrupt value', () => {
    localStorage.setItem('loupe.chords.bars-per-row', '4.5')
    expect(readStoredBarsPerRow()).toBeUndefined()
    localStorage.setItem('loupe.chords.bars-per-row', 'six')
    expect(readStoredBarsPerRow()).toBeUndefined()
  })

  it('exposes the default the panel falls back to', () => {
    expect(readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW).toBe(4)
  })
})
