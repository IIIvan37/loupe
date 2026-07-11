import {
  type BeatGrid,
  type ChordDetector,
  type DecodedAudio,
  detectChords
} from '@app/core'
import { useMemo, useRef, useState } from 'react'
import { createChordDetector } from '../../audio/create-chord-detector.ts'

export interface ChordDetection {
  /** Whether a detection is in flight (drives the busy button). */
  readonly detecting: boolean
  /** Why the last detection failed — cleared by the next run. */
  readonly error: string | undefined
  /** Whether the last run landed a draft (drives the a11y announcement). */
  readonly succeeded: boolean
  /**
   * Detect the loaded track's chords and hand the drafted grid source to
   * `onDraft`, wrapped at the given bars-per-row (the panel's layout).
   */
  readonly detect: (barsPerRow: number) => Promise<void>
}

/**
 * Smart hook (= driving adapter logic): runs the `detectChords` use-case
 * against the chord detector port (default: the local server; injected in
 * tests) and lands the drafted grid SOURCE through `onDraft` — the same lifted
 * session state the panel edits, so the draft persists like any manual edit.
 * A monotonic run token drops a slow detection whose track was replaced
 * mid-flight: the new track must not inherit the old one's chart.
 */
export function useChordDetection({
  loadedAudio,
  grid,
  onDraft,
  detector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly onDraft: (source: string) => void
  readonly detector?: ChordDetector | undefined
}): ChordDetection {
  const engine = useMemo(() => detector ?? createChordDetector(), [detector])
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string>()
  const [succeeded, setSucceeded] = useState(false)
  const runIdRef = useRef(0)

  // A replaced track supersedes any in-flight run — bump the token so its
  // late result is dropped instead of drafting over the new track's chart.
  // Adjusted inline during render (the prev-prop idiom), not in an effect, so
  // the busy state never paints one stale frame.
  const [prevAudio, setPrevAudio] = useState(loadedAudio)
  if (prevAudio !== loadedAudio) {
    setPrevAudio(loadedAudio)
    runIdRef.current++
    setDetecting(false)
    // The outcome belongs to the replaced track: a stale error (or a stale
    // success announcement) must not survive onto the new one.
    setError(undefined)
    setSucceeded(false)
  }

  // Held in refs so `detect` always reads the render-fresh values without
  // re-identifying itself (the panel keys nothing on it).
  const inputRef = useRef({ loadedAudio, grid, onDraft })
  inputRef.current = { loadedAudio, grid, onDraft }

  async function detect(barsPerRow: number): Promise<void> {
    const { loadedAudio: audio, grid: beatGrid } = inputRef.current
    if (!audio) {
      return
    }
    const runId = ++runIdRef.current
    setDetecting(true)
    setError(undefined)
    setSucceeded(false)
    const result = await detectChords(
      { audio, grid: beatGrid, barsPerRow },
      { detector: engine }
    )
    // Commit only if this is still the latest run (no newer detect, no track
    // swap since the await).
    if (runIdRef.current !== runId) {
      return
    }
    setDetecting(false)
    if (result.ok) {
      setSucceeded(true)
      inputRef.current.onDraft(result.source)
    } else {
      setError(result.error)
    }
  }

  return { detecting, error, succeeded, detect }
}
