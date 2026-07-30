import {
  type LoopRegion,
  makeLoopRegion,
  type NamedLoop,
  snapLoopRegionToGrid
} from '@app/core'
import { useAtom, useAtomValue } from 'jotai'
import { usePlayerHandle } from '../audio-session/audio-session.ts'
import { tempoAnalysisAtom } from '../tempo/tempo-atoms.ts'
import { activeLoopIdAtom } from './loop-atoms.ts'
import { useLoops } from './use-loops.ts'

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
    startSeconds: number,
    endSeconds: number,
    snap?: boolean
  ) => void
  /** A handle/keyboard edge edit: adjust the region, persisting a saved loop. */
  readonly adjustRegion: (
    startSeconds: number,
    endSeconds: number,
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
 * loop in place rather than spawning a duplicate. The bridge is session state
 * riding the feature's atoms (ADR 0010), and it drives the loupe through the
 * session's player (ADR 0011) — the beat grid drags snap to is the tempo
 * feature's own atom. Speed-trainer semantics: REPLACING the passage (a fresh
 * drag, a recalled loop) stops the ramp — it belongs to the passage it was
 * armed on; adjusting an edge keeps it running.
 */
export function useLoopEditing(): LoopEditing {
  const loops = useLoops()
  const player = usePlayerHandle()
  const beatGrid = useAtomValue(tempoAnalysisAtom)?.grid ?? []
  // The saved loop the active region came from. Null for a fresh, unsaved
  // selection.
  const [activeLoopId, setActiveLoopId] = useAtom(activeLoopIdAtom)

  function regionFrom(
    startSeconds: number,
    endSeconds: number,
    snap: boolean
  ): LoopRegion {
    const raw = makeLoopRegion(startSeconds, endSeconds)
    return snap ? snapLoopRegionToGrid(raw, beatGrid, 'beat') : raw
  }

  function selectRegion(
    startSeconds: number,
    endSeconds: number,
    snap = false
  ): void {
    setActiveLoopId(null)
    player.speedTrainer.stop()
    player.setLoopRegion(regionFrom(startSeconds, endSeconds, snap))
  }

  function adjustRegion(
    startSeconds: number,
    endSeconds: number,
    snap = false
  ): void {
    const region = regionFrom(startSeconds, endSeconds, snap)
    player.setLoopRegion(region)
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
    player.setLoopRegion(undefined)
  }

  /** Replace the loupe with a new passage and start it from its beginning. */
  function armSpan(region: LoopRegion): void {
    player.speedTrainer.stop()
    player.setLoopRegion(region)
    player.seekToSeconds(region.startSeconds)
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
