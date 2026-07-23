// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  readStoredRomanNumerals,
  storeRomanNumerals
} from './roman-preference.ts'

describe('roman-numeral preference', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips the stored choice', () => {
    storeRomanNumerals(true)
    expect(readStoredRomanNumerals()).toBe(true)
  })

  it('reads nothing when no preference was ever stored', () => {
    expect(readStoredRomanNumerals()).toBeUndefined()
  })

  it('never surfaces a corrupt value', () => {
    localStorage.setItem('loupe.chords.roman-numerals', 'oui')
    expect(readStoredRomanNumerals()).toBeUndefined()
  })
})
