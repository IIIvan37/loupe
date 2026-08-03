/**
 * Pure transport state machine: position, duration and a play/pause flag over a
 * bounded timeline. The reducer is the single source of truth the UI renders and
 * the playback engine is steered by — no Web Audio, no timers, just values.
 * The playhead itself streams at frame rate OUTSIDE the reducer (Lot L.1); what
 * each streamed frame means — loop wrap, end-of-track stop — is
 * `resolvePlaybackTick` (playback-tick.ts), and only its outcomes come back
 * here as 'seek'/'pause' dispatches.
 */
export interface TransportState {
  readonly positionSeconds: number
  readonly durationSeconds: number
  readonly isPlaying: boolean
}

export type TransportAction =
  | { readonly type: 'load'; readonly durationSeconds: number }
  | { readonly type: 'play' }
  | { readonly type: 'pause' }
  | { readonly type: 'toggle' }
  | { readonly type: 'seek'; readonly toSeconds: number }

export const initialTransport: TransportState = {
  positionSeconds: 0,
  durationSeconds: 0,
  isPlaying: false
}

/** Confine a position to the timeline `[0, duration]`. */
function clampPosition(seconds: number, durationSeconds: number): number {
  if (seconds < 0) {
    return 0
  }
  if (seconds > durationSeconds) {
    return durationSeconds
  }
  return seconds
}

export function transportReducer(
  state: TransportState,
  action: TransportAction
): TransportState {
  switch (action.type) {
    case 'load':
      return {
        positionSeconds: 0,
        durationSeconds: Math.max(0, action.durationSeconds),
        isPlaying: false
      }
    case 'play':
      return { ...state, isPlaying: true }
    case 'pause':
      return { ...state, isPlaying: false }
    case 'toggle':
      return { ...state, isPlaying: !state.isPlaying }
    case 'seek':
      return {
        ...state,
        positionSeconds: clampPosition(action.toSeconds, state.durationSeconds)
      }
  }
}
