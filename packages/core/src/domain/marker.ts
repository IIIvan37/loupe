/**
 * A labelled point on the timeline. Two kinds share the shape: a `structure`
 * marker mirrors a `[Section]` header of the chord chart (the chart text is
 * the authority — these are re-derived whenever the chart is edited, so hand
 * edits to them are overwritable), while a plain marker (no `kind`) is a cue
 * the user drops to find their way around (a tricky bar) and survives every
 * re-derivation. Bars and beats are not user markers: they belong to tempo
 * detection. Pure data; identity (`id`) is minted by the adapter.
 */
export interface Marker {
  readonly id: string
  readonly timeSeconds: number
  readonly label: string
  /** Present on chart-derived section markers; absent on hand-dropped cues. */
  readonly kind?: 'structure'
}
