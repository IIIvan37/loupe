import type { ChordChart } from '@app/core'

/**
 * Whether a parsed chart puts anything on the page: a grid, or at least a
 * directive-fed head. Shared by the sheet (which only emits its print region
 * over content) and the panel's « Imprimer » guard — the print stylesheet
 * and the button must agree on what is printable.
 */
export function chartHasContent(chart: ChordChart): boolean {
  return chart.sections.length > 0 || Object.keys(chart.directives).length > 0
}
