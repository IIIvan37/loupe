import type { LoopRegion } from '@app/core'
import { useState } from 'react'

export interface LoopController {
  /** The active A/B loop (the « loupe »), or undefined when off. */
  readonly loopRegion: LoopRegion | undefined
  /** Whether the active region actually loops playback (vs playing through). */
  readonly loopEnabled: boolean
  /** Seat/adjust the region; a fresh selection re-arms looping (see below). */
  readonly setLoopRegion: (region: LoopRegion | undefined) => void
  readonly toggleLoop: () => void
  /** Seat a persisted loupe: region and wrap choice together (project open). */
  readonly restoreLoop: (region: LoopRegion, enabled: boolean) => void
}

/**
 * The A/B loop state (« loupe ») in one place: the armed region, whether it
 * wraps, and the two seat/restore heuristics. Pure UI state — the transport
 * engines read the live values via {@link useTransportEngines} to wrap playback.
 */
export function useLoop(): LoopController {
  const [loopRegion, setLoopRegionState] = useState<LoopRegion | undefined>(
    undefined
  )
  const [loopEnabled, setLoopEnabledState] = useState(true)

  function setLoopRegion(region: LoopRegion | undefined): void {
    // Selecting a region where there was none re-arms looping, so a fresh loupe
    // loops straight away; adjusting an existing region leaves the choice alone.
    if (loopRegion === undefined && region !== undefined) {
      setLoopEnabledState(true)
    }
    setLoopRegionState(region)
  }

  function toggleLoop(): void {
    setLoopEnabledState((enabled) => !enabled)
  }

  /**
   * Seat a persisted loupe exactly as saved: region AND wrap choice together,
   * bypassing the fresh-selection re-arm heuristic of `setLoopRegion`.
   */
  function restoreLoop(region: LoopRegion, enabled: boolean): void {
    setLoopRegionState(region)
    setLoopEnabledState(enabled)
  }

  return { loopRegion, loopEnabled, setLoopRegion, toggleLoop, restoreLoop }
}
