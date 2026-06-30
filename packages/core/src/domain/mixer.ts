/**
 * Pure multitrack-mixer state: per stem, a volume in decibels plus mute/solo
 * flags. The reducer is the single source of truth the mixer UI renders;
 * `effectiveGains` folds the solo/mute rules into one linear gain per channel —
 * the value both the Web Audio gain graph and the fading waveforms read. No Web
 * Audio, no DOM, just values in and values out.
 */

/** Fader range in decibels: silence at the bottom, a little headroom on top. */
export const MIN_GAIN_DB = -60
export const MAX_GAIN_DB = 6
/** 0 dB — the stem plays at its separated level. */
export const UNITY_GAIN_DB = 0

export interface MixerChannel {
  readonly id: string
  /** Fader position in dB, clamped to [MIN_GAIN_DB, MAX_GAIN_DB]. */
  readonly gainDb: number
  readonly muted: boolean
  readonly soloed: boolean
}

/** The mixer: one channel per stem, in display order. */
export type MixerState = readonly MixerChannel[]

export type MixerAction =
  | { readonly type: 'init'; readonly ids: readonly string[] }
  | { readonly type: 'setGain'; readonly id: string; readonly gainDb: number }
  | { readonly type: 'toggleMute'; readonly id: string }
  | { readonly type: 'toggleSolo'; readonly id: string }
  | { readonly type: 'reset' }

export const emptyMixer: MixerState = []

/** Confine a fader level to the supported dB range; `NaN` falls back to unity. */
export function clampGainDb(db: number): number {
  if (Number.isNaN(db)) {
    return UNITY_GAIN_DB
  }
  if (db < MIN_GAIN_DB) {
    return MIN_GAIN_DB
  }
  if (db > MAX_GAIN_DB) {
    return MAX_GAIN_DB
  }
  return db
}

/**
 * Convert a decibel level to a linear amplitude multiplier (0 dB → 1). The very
 * bottom of the fader is treated as true silence (exactly 0) rather than the
 * −60 dB residue, so a fader pulled all the way down is genuinely off.
 */
export function dbToAmplitude(db: number): number {
  if (db <= MIN_GAIN_DB) {
    return 0
  }
  return 10 ** (db / 20)
}

export function mixerReducer(
  state: MixerState,
  action: MixerAction
): MixerState {
  switch (action.type) {
    case 'init':
      return action.ids.map((id) => ({
        id,
        gainDb: UNITY_GAIN_DB,
        muted: false,
        soloed: false
      }))
    case 'setGain':
      return state.map((channel) =>
        channel.id === action.id
          ? { ...channel, gainDb: clampGainDb(action.gainDb) }
          : channel
      )
    case 'toggleMute':
      return state.map((channel) =>
        channel.id === action.id
          ? { ...channel, muted: !channel.muted }
          : channel
      )
    case 'toggleSolo':
      return state.map((channel) =>
        channel.id === action.id
          ? { ...channel, soloed: !channel.soloed }
          : channel
      )
    case 'reset':
      return emptyMixer
  }
}

/** One channel's resolved output level: a linear gain (0 when silenced). */
export interface ChannelGain {
  readonly id: string
  readonly gain: number
}

/**
 * Fold the solo/mute rules into a linear gain per channel: a mute silences its
 * own channel; any active solo silences every channel that is not itself soloed.
 * Mute wins over solo. Otherwise the channel plays at its dB-derived amplitude.
 */
export function effectiveGains(state: MixerState): readonly ChannelGain[] {
  const anySolo = state.some((channel) => channel.soloed)
  return state.map((channel) => {
    const audible = !channel.muted && (!anySolo || channel.soloed)
    return { id: channel.id, gain: audible ? dbToAmplitude(channel.gainDb) : 0 }
  })
}
