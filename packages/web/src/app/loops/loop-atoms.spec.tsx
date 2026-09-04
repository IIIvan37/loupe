// @vitest-environment jsdom
import type {
  LoopRegion,
  NamedLoop,
  SpeedTrainerSeam,
  TempoAnalysis
} from '@app/core'
import { act, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { PlayerHandle } from '../audio-session/audio-session.ts'
import { AudioSessionProvider } from '../audio-session/audio-session-provider.tsx'
import { tempoAnalysisAtom } from '../tempo/tempo-atoms.ts'
import { useLoopEditing } from './use-loop-editing.ts'
import { useLoops } from './use-loops.ts'

/** The single saved loop of a test library, or a loud failure. */
function onlyLoop(library: readonly NamedLoop[]): NamedLoop {
  const [loop] = library
  if (loop === undefined) {
    throw new Error('expected one saved loop')
  }
  return loop
}

/** A session player that records how the loops feature drives it. */
function recordingPlayer() {
  const calls = {
    regions: [] as (LoopRegion | undefined)[],
    seeks: [] as number[],
    trainerSeams: [] as SpeedTrainerSeam[]
  }
  // Only the three members this feature drives record; the rest are inert.
  const player: PlayerHandle = {
    position: { get: () => 0, subscribe: () => () => {} },
    readSpectrum: () => undefined,
    seekToSeconds: (seconds) => calls.seeks.push(seconds),
    seekToRatio: () => {},
    importFile: async () => undefined,
    togglePlayback: () => {},
    setTimeRatio: () => {},
    setPitchSemitones: () => {},
    setFineTuneCents: () => {},
    restoreTuning: () => {},
    restoreLoop: () => {},
    toggleLoop: () => {},
    setLoopRegion: (region) => calls.regions.push(region),
    speedTrainer: {
      start: () => {},
      stop: () => {},
      cross: (seam) => calls.trainerSeams.push(seam)
    }
  }
  return { player, calls }
}

/**
 * Two consumers of the loops feature under ONE store — the shape the regions
 * reach when they call the hooks themselves (ADR 0010): the library and the
 * active-loop id are session state, and the player is driven through the
 * session's handle (ADR 0011), never through threaded props.
 */
function mountTwo(analysis?: TempoAnalysis) {
  const store = createStore()
  if (analysis) {
    store.set(tempoAnalysisAtom, analysis)
  }
  const { player, calls } = recordingPlayer()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <AudioSessionProvider value={{ player }}>
      <Provider store={store}>{children}</Provider>
    </AudioSessionProvider>
  )
  const a = renderHook(
    () => ({ loops: useLoops(), editing: useLoopEditing() }),
    { wrapper }
  )
  const b = renderHook(
    () => ({ loops: useLoops(), editing: useLoopEditing() }),
    { wrapper }
  )
  return { a, b, calls }
}

describe('useLoops across two consumers (one store)', () => {
  it('shares the library: a loop saved by one is seen by the other', () => {
    const { a, b } = mountTwo()

    act(() => {
      a.result.current.loops.save('Refrain', {
        startSeconds: 1,
        endSeconds: 2
      })
    })

    expect(b.result.current.loops.library.map((loop) => loop.name)).toEqual([
      'Refrain'
    ])
  })
})

describe('useLoopEditing across two consumers (one store)', () => {
  it('shares the active saved loop: a save through one marks the other saved', () => {
    const { a, b } = mountTwo()

    act(() => {
      a.result.current.editing.saveRegion('Pont', {
        startSeconds: 3,
        endSeconds: 5
      })
    })

    expect(b.result.current.editing.isSaved).toBe(true)
    expect(b.result.current.editing.activeLoopId).toBe(
      a.result.current.editing.activeLoopId
    )
  })

  it('recalls a saved loop through the session player: region, seek, ramp stop', () => {
    const { a, b, calls } = mountTwo()
    const saved: LoopRegion = { startSeconds: 4, endSeconds: 6 }
    act(() => {
      a.result.current.editing.saveRegion('Solo', saved)
    })

    const loop = onlyLoop(a.result.current.loops.library)
    act(() => {
      b.result.current.editing.activate(loop)
    })

    expect(calls.regions.at(-1)).toEqual(saved)
    expect(calls.seeks.at(-1)).toBe(4)
    // Recalling a loop replaces the passage: the feature names that seam and
    // the core's single rule (speedTrainerSurvives) decides the ramp's fate.
    expect(calls.trainerSeams).toContain('loupe-selected')
    expect(a.result.current.editing.activeLoopId).toBe(loop.id)
  })

  it('snaps a fresh drag onto the session beat grid it reads itself', () => {
    const grid = [0, 0.5, 1, 1.5, 2].map((timeSeconds, index) => ({
      timeSeconds,
      downbeat: index % 4 === 0
    }))
    const { a, calls } = mountTwo({ bpm: 120, grid, beatsPerBar: 4 })

    act(() => {
      a.result.current.editing.selectRegion(0.3, 1.9, true)
    })

    expect(calls.regions.at(-1)).toEqual({ startSeconds: 0.5, endSeconds: 2 })
    // A fresh drag is detached from any saved loop.
    expect(a.result.current.editing.isSaved).toBe(false)
  })

  it('persists a handle edit into the saved loop it came from, for every consumer', () => {
    const { a, b } = mountTwo()
    act(() => {
      a.result.current.editing.saveRegion('Thème', {
        startSeconds: 1,
        endSeconds: 2
      })
    })

    act(() => {
      b.result.current.editing.adjustRegion(1, 3)
    })

    expect(a.result.current.loops.library[0]?.region).toEqual({
      startSeconds: 1,
      endSeconds: 3
    })
  })

  it('removing the active loop from another consumer marks the region unsaved', () => {
    const { a, b } = mountTwo()
    act(() => {
      a.result.current.editing.saveRegion('Intro', {
        startSeconds: 0,
        endSeconds: 1
      })
    })
    const loop = onlyLoop(a.result.current.loops.library)

    act(() => {
      b.result.current.editing.remove(loop.id)
    })

    expect(a.result.current.editing.isSaved).toBe(false)
    expect(b.result.current.loops.library).toEqual([])
  })
})
