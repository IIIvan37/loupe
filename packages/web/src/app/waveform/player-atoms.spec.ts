import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import {
  fineTuneCentsAtom,
  pitchSemitonesAtom,
  timeRatioAtom,
  tuningAtom
} from './player-atoms.ts'
import { viewportZoomAtom } from './viewport-atoms.ts'

describe('tuningAtom — the live tuning as a manifest persists it', () => {
  it('rests at the neutral tuning, fine-tune absent', () => {
    const store = createStore()

    expect(store.get(tuningAtom)).toEqual({
      timeRatio: 1,
      pitchSemitones: 0,
      zoom: 1
    })
  })

  it('follows every knob the features own — tempo, pitch, zoom, fine-tune', () => {
    const store = createStore()
    store.set(timeRatioAtom, 0.85)
    store.set(pitchSemitonesAtom, -2)
    store.set(viewportZoomAtom, 3)
    store.set(fineTuneCentsAtom, 30)

    expect(store.get(tuningAtom)).toEqual({
      timeRatio: 0.85,
      pitchSemitones: -2,
      zoom: 3,
      fineTuneCents: 30
    })
  })
})
