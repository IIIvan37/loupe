/**
 * A labelled point on the timeline. The three kinds form a hierarchy of
 * granularity — a song section, a bar, a beat — that the UI renders with
 * decreasing prominence. Pure data; identity (`id`) is minted by the adapter.
 */
export type MarkerKind = 'section' | 'measure' | 'beat'

export interface Marker {
  readonly id: string
  readonly timeSeconds: number
  readonly kind: MarkerKind
  readonly label: string
}
