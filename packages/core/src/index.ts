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
  NameSource
} from './application/ports.ts'
export type { Greeting } from './domain/greeting.ts'
export { buildGreeting } from './domain/greeting.ts'
export type { Track } from './domain/track.ts'
export type { Waveform, WaveformPeak } from './domain/waveform.ts'
