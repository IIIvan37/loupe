import { parseChart } from '@app/core'
import { msg } from '@lingui/core/macro'
import { i18n } from '../../i18n/i18n.ts'

// The folded header's read-out reuses the flows' own words where they exist
// (tempo.bpm, separation.done) — one catalog entry per fact.
const BPM = msg({ id: 'tempo.bpm', message: '{0} BPM' })
const SEPARATED = msg({ id: 'separation.done', message: 'Pistes séparées' })
const METER = msg({ id: 'analyser.summary-meter', message: '{0} temps' })
const SECTIONS = msg({
  id: 'analyser.summary-sections',
  message: '{0, plural, one {# section} other {# sections}}'
})
const GRID = msg({ id: 'analyser.summary-grid', message: 'grille {0} mes.' })

export interface AnalysisSummaryInput {
  readonly separated: boolean
  readonly bpm: number | undefined
  readonly beatsPerBar: number | undefined
  /** How many STRUCTURE markers the timeline holds. */
  readonly sectionCount: number
  /** The chart source — measures are counted through the unrolled form. */
  readonly chartSource: string
}

/**
 * What the machine acquired, folded to one line for the collapsed Analyse
 * header (Q.3): « Pistes séparées · 120 BPM · 4 temps · 12 sections ·
 * grille 96 mes. » — only the facts that exist appear; none yields undefined
 * (the header then shows nothing).
 */
export function analysisSummary(
  input: AnalysisSummaryInput
): string | undefined {
  const parts: string[] = []
  if (input.separated) {
    parts.push(i18n._(SEPARATED))
  }
  if (input.bpm !== undefined) {
    parts.push(i18n._({ ...BPM, values: { 0: Math.round(input.bpm) } }))
  }
  if (input.beatsPerBar !== undefined) {
    parts.push(i18n._({ ...METER, values: { 0: input.beatsPerBar } }))
  }
  if (input.sectionCount > 0) {
    parts.push(i18n._({ ...SECTIONS, values: { 0: input.sectionCount } }))
  }
  // The WRITTEN grid size — what the sheet displays — not the unrolled form.
  const measures =
    input.chartSource.trim().length > 0
      ? parseChart(input.chartSource).sections.flatMap(
          (section) => section.measures
        ).length
      : 0
  if (measures > 0) {
    parts.push(i18n._({ ...GRID, values: { 0: measures } }))
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}
