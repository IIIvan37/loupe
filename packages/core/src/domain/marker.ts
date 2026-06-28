/**
 * A labelled point on the timeline — a named cue the user drops to find their
 * way around (intro, chorus, a tricky bar). Bars and beats are not user markers:
 * they belong to tempo detection (a later jalon). Pure data; identity (`id`) is
 * minted by the adapter.
 */
export interface Marker {
  readonly id: string
  readonly timeSeconds: number
  readonly label: string
}
