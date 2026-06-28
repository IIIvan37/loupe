// Public contract of the core (the only surface adapters consume).

export type { GreetDeps, GreetResult } from './application/greet.ts'
export { greet } from './application/greet.ts'
export type {
  LoadTrackDeps,
  LoadTrackInput,
  LoadTrackResult
} from './application/load-track.ts'
export { loadTrack } from './application/load-track.ts'
export type {
  AudioFileDecoder,
  DecodedAudio,
  GreetingSink,
  NameSource,
  PlaybackEngine
} from './application/ports.ts'
export type { Greeting } from './domain/greeting.ts'
export { buildGreeting } from './domain/greeting.ts'
export {
  clampPitchSemitones,
  MAX_PITCH_SEMITONES,
  MIN_PITCH_SEMITONES
} from './domain/pitch-shift.ts'
export {
  clampPlaybackRate,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE
} from './domain/playback-rate.ts'
export { formatTimecode } from './domain/timecode.ts'
export type { Track } from './domain/track.ts'
export type {
  TransportAction,
  TransportState
} from './domain/transport.ts'
export { initialTransport, transportReducer } from './domain/transport.ts'
export type { Waveform, WaveformPeak } from './domain/waveform.ts'
