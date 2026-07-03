import type {
  LoopLibrary,
  MarkerList,
  MixerState,
  ProjectActiveLoop
} from '@app/core'

/** The light, persisted parts of a session — both a live session and a saved
 * `Project` narrow to this shape, so the two sides sign identically. */
export interface SignedSession {
  readonly loops: LoopLibrary
  readonly markers: MarkerList
  readonly activeLoop?: ProjectActiveLoop | undefined
  readonly separation?: { readonly mixer: MixerState } | undefined
}

/**
 * A canonical fingerprint of what a save would persist (minus the heavy
 * audio, which only changes with a new import or separation). Equal
 * signatures ⇔ the saved project already holds this session — the basis of
 * the « Enregistré / Non enregistré » read-out. Fields are re-projected
 * explicitly so extra properties and key order can never skew the comparison.
 */
export function sessionSignature(session: SignedSession): string {
  return JSON.stringify({
    loops: session.loops.map((loop) => [
      loop.id,
      loop.name,
      loop.region.startSeconds,
      loop.region.endSeconds
    ]),
    markers: session.markers.map((marker) => [
      marker.id,
      marker.timeSeconds,
      marker.label
    ]),
    activeLoop: session.activeLoop
      ? [
          session.activeLoop.region.startSeconds,
          session.activeLoop.region.endSeconds,
          session.activeLoop.enabled
        ]
      : null,
    mixer: session.separation
      ? session.separation.mixer.map((channel) => [
          channel.id,
          channel.gainDb,
          channel.muted,
          channel.soloed
        ])
      : null
  })
}

/** What a session with nothing worth keeping signs as — the baseline the
 * destructive-path guards (import, reload, project open) compare against. */
export const EMPTY_SESSION_SIGNATURE: string = sessionSignature({
  loops: [],
  markers: []
})
