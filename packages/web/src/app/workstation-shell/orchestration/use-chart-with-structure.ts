import type {
  ChordDetector,
  DecodedAudio,
  MarkerList,
  SeparatedStem,
  StructureDetector,
  TempoAnalysis
} from '@app/core'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo } from 'react'
import { useLatest } from '../../../lib/use-latest.ts'
import { useAudioSession } from '../../audio-session/audio-session.ts'
import {
  DEFAULT_BARS_PER_ROW,
  readStoredBarsPerRow
} from '../../lead-sheet/bars-per-row-preference.ts'
import {
  type ChordChartState,
  useChordChart
} from '../../lead-sheet/use-chord-chart.ts'
import { useChordChartSession } from '../../lead-sheet/use-chord-chart-session.ts'
import type { ChordDetection } from '../../lead-sheet/use-chord-detection.ts'
import { syncStructureMarkersFromChart } from '../../markers/chart-marker-sync.ts'
import { structureEditSyncAtom } from '../../markers/marker-atoms.ts'
import { relabelChartFromSections } from '../../markers/relabel-chart.ts'
import { markerSections } from '../../markers/section-markers.ts'
import type { Markers } from '../../markers/use-markers.ts'
import type { StructureDetection } from '../../markers/use-structure-detection.ts'
import { useStructureMarkers } from '../../markers/use-structure-markers.ts'

/**
 * The chart ↔ structure pairing, off the shell: the chart session (edits +
 * « Détecter les accords ») is built FIRST because the structure flow relabels
 * that same source (S.3b), and every user edit of the source re-derives the
 * structure markers (chart = authority). Both flows read the same grid and the
 * same felt bar length, so the pairing owns that plumbing too.
 */
export function useChartWithStructure({
  loadedAudio,
  analysis,
  markers,
  separation,
  separateAndLoad,
  chordDetector,
  structureDetector
}: {
  readonly loadedAudio: DecodedAudio | undefined
  readonly analysis: TempoAnalysis | undefined
  readonly markers: Markers
  /** The session's separation surface (4a) — its live stems feed the chord
   * detector a mix minus drums; its cancel rides the chord run's « Annuler »
   * during an implicit separation (AD.1). */
  readonly separation: {
    readonly sources: readonly SeparatedStem[]
    readonly cancel: () => void
  }
  /** The shell's separate-and-wire flow — the chord run's implicit
   * separation when no stems exist yet (resolves the isolated sources). */
  readonly separateAndLoad: (
    audio: DecodedAudio | undefined
  ) => Promise<readonly SeparatedStem[] | undefined>
  readonly chordDetector?: ChordDetector | undefined
  readonly structureDetector?: StructureDetector | undefined
}): {
  readonly chordChart: ChordChartState
  readonly chordDetection: ChordDetection
  readonly structureDetection: StructureDetection
} {
  const grid = analysis?.grid ?? []
  const beatsPerBar = analysis?.beatsPerBar
  // A structure already on the timeline cuts the detected draft — the reverse
  // order (chords first) leaves this empty and the draft deduces. Memoized so
  // the derived array's identity only turns over with the marker list.
  const sections = useMemo(
    () => markerSections(markers.markers),
    [markers.markers]
  )
  // The detectors are session ports (ADR 0011): an explicit arg (unit tests)
  // wins, then the session's injection, then the real adapter downstream.
  const session = useAudioSession()
  const { chart: chordChart, detection: chordDetection } = useChordChartSession(
    {
      loadedAudio,
      grid,
      beatsPerBar,
      sections,
      stems: separation.sources.length > 0 ? separation.sources : undefined,
      ensureStems: () => separateAndLoad(loadedAudio),
      cancelSeparation: separation.cancel,
      detector: chordDetector ?? session.chordDetector,
      onSourceEdited: (source) =>
        syncStructureMarkersFromChart(source, grid, markers)
    }
  )
  const structureDetection = useStructureMarkers({
    loadedAudio,
    grid,
    beatsPerBar,
    markers,
    chart: chordChart,
    detector: structureDetector ?? session.structureDetector
  })
  useStructureEditRelabel(grid, beatsPerBar)
  return { chordChart, chordDetection, structureDetection }
}

/**
 * The marker→chart half of the structure sync (the mirror of
 * `syncStructureMarkersFromChart`): seat the markers feature's edit box with a
 * relabel of the chart from the edited timeline, so moving, renaming, adding
 * or removing a structure marker rewrites the `[Section]` headers — the
 * adjustments a saved project needs without re-running a detection. The chart
 * is written through its SILENT surface (`useChordChart`, not the session
 * wrapper): the markers are the edit's origin, so bouncing the new text back
 * through `setSections` would re-mint their identities mid-gesture. Chords
 * are kept verbatim by the relabel, so the transposition offset stays valid.
 * Without a downbeat there is no bar to place a header on, and an empty chart
 * has nothing to relabel — the timeline keeps its markers either way.
 */
function useStructureEditRelabel(
  grid: TempoAnalysis['grid'],
  beatsPerBar: number | undefined
): void {
  const chart = useChordChart()
  const sync = useAtomValue(structureEditSyncAtom)
  const relabel = useLatest((edited: MarkerList) => {
    if (chart.source.trim() === '' || !grid.some((beat) => beat.downbeat)) {
      return
    }
    const next = relabelChartFromSections(
      chart.source,
      markerSections(edited),
      grid,
      readStoredBarsPerRow() ?? DEFAULT_BARS_PER_ROW,
      beatsPerBar
    )
    if (next !== chart.source) {
      chart.setSource(next)
    }
  })
  useEffect(() => {
    sync.onStructureEdited = (edited) => relabel.current(edited)
    return () => {
      sync.onStructureEdited = undefined
    }
  }, [sync])
}
