import type { ChartHeaderData } from './chart-header.tsx'

/**
 * Derive the chart head from the session — the same identity fallbacks as the
 * app header (tags first, file name second); no artist placeholder (a chart
 * prints blank, never « Artiste inconnu »).
 */
export function deriveChartHeader(
  metadata: {
    readonly title?: string | undefined
    readonly artist?: string | undefined
  },
  trackName: string | null,
  analysis:
    | { readonly bpm: number; readonly beatsPerBar?: number | undefined }
    | undefined
): ChartHeaderData {
  return {
    title: metadata.title ?? trackName ?? undefined,
    artist: metadata.artist,
    bpm: analysis?.bpm,
    beatsPerBar: analysis?.beatsPerBar
  }
}
