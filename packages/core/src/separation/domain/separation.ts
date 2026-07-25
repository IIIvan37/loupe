import type { StemSet } from './stem-set.ts'

/**
 * The two long-running phases a separation reports: first it analyses the mix
 * (which sources are present), then it separates them. The pure state machine
 * and the `StemSeparator` port both speak in these terms.
 */
export type SeparationPhase = 'analysing' | 'separating'

export type SeparationStatus = 'idle' | SeparationPhase | 'ready' | 'error'

/**
 * Why a separation failed, discriminated so the UI can speak each case in the
 * user's language (Lot G standard) instead of echoing raw engine text — the
 * same contract the detections carry (N.1, extended to separation in M1.4).
 */
export type SeparationErrorCode =
  | 'engine-unavailable'
  | 'network'
  | 'timeout'
  | 'too-large'
  | 'unknown'

/** A failed run: the code drives the copy, the detail goes to the console. */
export interface SeparationFailure {
  readonly code: SeparationErrorCode
  readonly detail: string
}

/**
 * Pure separation state machine: the progress of turning the loaded track into
 * stems. The reducer is the single source of truth the import → separation
 * screen renders — no workers, no timers, just values. Progress events stream in
 * from the separator port; the result and any error land here too.
 */
export interface SeparationState {
  readonly status: SeparationStatus
  /** Completion of the running phase in [0, 1]; 1 once ready. */
  readonly progress: number
  readonly stems: StemSet
  readonly error: SeparationFailure | undefined
}

export type SeparationAction =
  | { readonly type: 'start' }
  | {
      readonly type: 'progress'
      readonly phase: SeparationPhase
      readonly fraction: number
    }
  | { readonly type: 'ready'; readonly stems: StemSet }
  | {
      readonly type: 'fail'
      readonly code: SeparationErrorCode
      readonly detail: string
    }
  | { readonly type: 'reset' }

export const initialSeparation: SeparationState = {
  status: 'idle',
  progress: 0,
  stems: [],
  error: undefined
}

/** Confine a completion fraction to [0, 1]. */
function clampFraction(fraction: number): number {
  if (fraction < 0) {
    return 0
  }
  if (fraction > 1) {
    return 1
  }
  return fraction
}

export function separationReducer(
  state: SeparationState,
  action: SeparationAction
): SeparationState {
  switch (action.type) {
    case 'start':
      // A fresh run drops any prior result so a re-separation starts clean.
      return { status: 'analysing', progress: 0, stems: [], error: undefined }
    case 'progress':
      return {
        ...state,
        status: action.phase,
        progress: clampFraction(action.fraction)
      }
    case 'ready':
      return {
        ...state,
        status: 'ready',
        progress: 1,
        stems: action.stems,
        error: undefined
      }
    case 'fail':
      return {
        ...state,
        status: 'error',
        error: { code: action.code, detail: action.detail }
      }
    case 'reset':
      return initialSeparation
  }
}
