// Public contract of the core (the only surface adapters consume).

export type { GreetDeps, GreetResult } from './application/greet.ts'
export { greet } from './application/greet.ts'
export type {
  LoadTrackDeps,
  LoadTrackInput,
  LoadTrackResult
} from './application/load-track.ts'
export { loadTrack } from './application/load-track.ts'
export type { LoopStoreDeps } from './application/loops.ts'
export { deleteLoop, loadLoops, saveLoop } from './application/loops.ts'
export type {
  AudioFileDecoder,
  DecodedAudio,
  GreetingSink,
  LoopStore,
  NameSource,
  PlaybackEngine,
  TrackMetadata,
  TrackMetadataReader
} from './application/ports.ts'
export type { Greeting } from './domain/greeting.ts'
export { buildGreeting } from './domain/greeting.ts'
export type {
  Command,
  KeyBinding,
  KeyBindings,
  KeyChord
} from './domain/key-bindings.ts'
export {
  defaultKeyBindings,
  resolveCommand,
  SEEK_STEP_SECONDS
} from './domain/key-bindings.ts'
export type { LoopLibrary, NamedLoop } from './domain/loop-library.ts'
export {
  addLoop,
  emptyLoopLibrary,
  removeLoop
} from './domain/loop-library.ts'
export type { LoopRegion } from './domain/loop-region.ts'
export {
  loopContains,
  loopLength,
  makeLoopRegion,
  wrapToLoop
} from './domain/loop-region.ts'
export type { Marker, MarkerKind } from './domain/marker.ts'
export type { MarkerList } from './domain/marker-list.ts'
export {
  addMarker,
  emptyMarkerList,
  removeMarker
} from './domain/marker-list.ts'
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
export {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  zoomIn,
  zoomOut
} from './domain/viewport.ts'
export type { Waveform, WaveformPeak } from './domain/waveform.ts'
