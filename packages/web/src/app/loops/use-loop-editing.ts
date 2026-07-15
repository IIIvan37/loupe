import {
  type BeatGrid,
  type LoopRegion,
  makeLoopRegion,
  type NamedLoop,
  snapLoopRegionToGrid
} from '@app/core'
import { useState } from 'react'
import type { Loops } from './use-loops.ts'

export interface LoopEditing {
  /** Whether the active region already belongs to a saved loop. */
  readonly isSaved: boolean
  /** The saved loop the active region came from, or null (highlights its chip). */
  readonly activeLoopId: string | null
  /**
   * A fresh surface drag: a new, unsaved region detached from any saved loop.
   * `snap` pulls the edges onto the beat grid when one exists.
   */
  readonly selectRegion: (
    startRatio: number,
    endRatio: number,
    snap?: boolean
  ) => void
  /** A handle/keyboard edge edit: adjust the region, persisting a saved loop. */
  readonly adjustRegion: (
    startRatio: number,
    endRatio: number,
    snap?: boolean
  ) => void
  /**
   * Arm the loupe on a span given in seconds (a structure section's bounds) —
   * a fresh, unsaved region, recalled like a saved loop (seeks its start).
   */
  readonly selectSpan: (region: LoopRegion) => void
  /** Save the active region under a name; it becomes the active saved loop. */
  readonly saveRegion: (name: string, region: LoopRegion) => void
  /** Discard a throwaway selection. */
  readonly clearRegion: () => void
  /** Recall a saved loop: make it active and seek to its start. */
  readonly activate: (loop: NamedLoop) => void
  /**
   * Relink a restored region to the saved loop it came from (a project open) —
   * `null` for a region that was never saved. No seek: the region is being
   * seated, not recalled.
   */
  readonly restore: (savedLoopId: string | null) => void
  /** Remove a saved loop; if it backed the active region, mark it unsaved. */
  readonly remove: (id: string) => void
}

/**
 * Smart hook bridging the active A/B region and the saved-loop library: it
 * tracks which saved loop the region came from, so handle edits update that
 * loop in place rather than spawning a duplicate.
 */
export function useLoopEditing(
  loops: Loops,
  transport: {
    readonly durationSeconds: number
    readonly setLoopRegion: (region: LoopRegion | undefined) => void
    readonly seekToSeconds: (seconds: number) => void
    /**
     * The active region is being REPLACED by a different passage (a fresh
     * surface drag, a recalled saved loop) — not adjusted in place. The speed
     * trainer stops here: its ramp belongs to the passage it was armed on.
     */
    readonly onRegionReplaced?: () => void
    /** The detected beat grid drag ends snap to; empty/absent = no snapping. */
    readonly beatGrid?: BeatGrid
  }
): LoopEditing {
  const beatGrid = transport.beatGrid ?? []
  // The saved loop the active region came from. Null for a fresh, unsaved
  // selection.
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null)

  function regionFromRatios(
    startRatio: number,
    endRatio: number,
    snap: boolean
  ): LoopRegion {
    const raw = makeLoopRegion(
      startRatio * transport.durationSeconds,
      endRatio * transport.durationSeconds
    )
    return snap ? snapLoopRegionToGrid(raw, beatGrid, 'beat') : raw
  }

  function selectRegion(
    startRatio: number,
    endRatio: number,
    snap = false
  ): void {
    setActiveLoopId(null)
    transport.onRegionReplaced?.()
    transport.setLoopRegion(regionFromRatios(startRatio, endRatio, snap))
  }

  function adjustRegion(
    startRatio: number,
    endRatio: number,
    snap = false
  ): void {
    const region = regionFromRatios(startRatio, endRatio, snap)
    transport.setLoopRegion(region)
    const active = loops.library.find((loop) => loop.id === activeLoopId)
    if (active) {
      loops.update({ ...active, region })
    }
  }

  function saveRegion(name: string, region: LoopRegion): void {
    setActiveLoopId(loops.save(name, region).id)
  }

  function clearRegion(): void {
    setActiveLoopId(null)
    transport.setLoopRegion(undefined)
  }

  /** Replace the loupe with a new passage and start it from its beginning. */
  function armSpan(region: LoopRegion): void {
    transport.onRegionReplaced?.()
    transport.setLoopRegion(region)
    transport.seekToSeconds(region.startSeconds)
  }

  function selectSpan(region: LoopRegion): void {
    setActiveLoopId(null)
    armSpan(region)
  }

  function activate(loop: NamedLoop): void {
    setActiveLoopId(loop.id)
    armSpan(loop.region)
  }

  function remove(id: string): void {
    // The region outlives its loop, but as a fresh, unsaved selection.
    if (id === activeLoopId) {
      setActiveLoopId(null)
    }
    loops.remove(id)
  }

  return {
    isSaved: activeLoopId !== null,
    activeLoopId,
    selectRegion,
    adjustRegion,
    selectSpan,
    saveRegion,
    clearRegion,
    activate,
    restore: setActiveLoopId,
    remove
  }
}
