import type {
  BeatGrid,
  ChordDetector,
  DecodedAudio,
  DetectedSection,
  SeparatedStem
} from '@app/core'
import { useChordChart } from './use-chord-chart.ts'
import {
  type ChordDetection,
  useChordDetection
} from './use-chord-detection.ts'

/**
 * The chord chart's whole session surface, one hook for the shell: the source
 * text (session state — saved with the project, restored on open, cleared by a
 * fresh import; it lives above the panel, which unmounts while a track loads)
 * plus the « Détecter les accords » flow drafting into that same source, so a
 * detection persists exactly like a manual edit.
 */
export function useChordChartSession({
  loadedAudio,
  grid,
  beatsPerBar,
  sections,
  stems,
  ensureStems,
  cancelSeparation,
  detector,
  onSourceEdited
}: {
  /** The session's separated stems (4a) — chords then hear mix minus drums. */
  readonly stems?: ReadonlyArray<SeparatedStem> | undefined
  /** Implicit separation before a chord run when no stems exist yet. */
  readonly ensureStems?:
    | (() => Promise<ReadonlyArray<SeparatedStem> | undefined>)
    | undefined
  /** Cancel the implicit separation with the chord run that started it. */
  readonly cancelSeparation?: (() => void) | undefined
  readonly loadedAudio: DecodedAudio | undefined
  readonly grid: BeatGrid
  readonly beatsPerBar?: number | undefined
  /** The song's already-known sections (the timeline's structure markers) —
   * a detected draft is cut by them so a prior detection is not erased. */
  readonly sections?: readonly DetectedSection[] | undefined
  readonly detector?: ChordDetector | undefined
  /**
   * Fired after every USER edit of the source — typing and seated drafts, but
   * never a restore or reset — with the new text. The shell re-derives the
   * structure markers here (the chart's headers are the timeline's authority);
   * restores stay silent so saved hand-fixes survive reopening.
   */
  readonly onSourceEdited?: ((source: string) => void) | undefined
}): {
  readonly chart: ReturnType<typeof useChordChart>
  readonly detection: ChordDetection
} {
  const edited = useChordChart()
  const chart = {
    ...edited,
    setSource: (source: string) => {
      edited.setSource(source)
      onSourceEdited?.(source)
    },
    seatDraft: (draft: string) => {
      edited.seatDraft(draft)
      onSourceEdited?.(draft)
    }
  }
  const detection = useChordDetection({
    loadedAudio,
    grid,
    beatsPerBar,
    sections,
    stems,
    ensureStems,
    cancelSeparation,
    // A landed draft is in the track's own key — it resets the key offset.
    onDraft: chart.seatDraft,
    detector
  })
  return { chart, detection }
}
