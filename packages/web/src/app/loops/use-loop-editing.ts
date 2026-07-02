import { type LoopRegion, makeLoopRegion, type NamedLoop } from '@app/core'
import { useState } from 'react'
import type { Loops } from './use-loops.ts'

export interface LoopEditing {
  /** Whether the active region already belongs to a saved loop. */
  readonly isSaved: boolean
  /** A fresh surface drag: a new, unsaved region detached from any saved loop. */
  readonly selectRegion: (startRatio: number, endRatio: number) => void
  /** A handle/keyboard edge edit: adjust the region, persisting a saved loop. */
  readonly adjustRegion: (startRatio: number, endRatio: number) => void
  /** Save the active region under a name; it becomes the active saved loop. */
  readonly saveRegion: (name: string, region: LoopRegion) => void
  /** Discard a throwaway selection. */
  readonly clearRegion: () => void
  /** Recall a saved loop: make it active and seek to its start. */
  readonly activate: (loop: NamedLoop) => void
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
  }
): LoopEditing {
  // The saved loop the active region came from. Null for a fresh, unsaved
  // selection.
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null)

  function regionFromRatios(startRatio: number, endRatio: number): LoopRegion {
    return makeLoopRegion(
      startRatio * transport.durationSeconds,
      endRatio * transport.durationSeconds
    )
  }

  function selectRegion(startRatio: number, endRatio: number): void {
    setActiveLoopId(null)
    transport.setLoopRegion(regionFromRatios(startRatio, endRatio))
  }

  function adjustRegion(startRatio: number, endRatio: number): void {
    const region = regionFromRatios(startRatio, endRatio)
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

  function activate(loop: NamedLoop): void {
    setActiveLoopId(loop.id)
    transport.setLoopRegion(loop.region)
    transport.seekToSeconds(loop.region.startSeconds)
  }

  return {
    isSaved: activeLoopId !== null,
    selectRegion,
    adjustRegion,
    saveRegion,
    clearRegion,
    activate
  }
}
