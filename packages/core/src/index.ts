// Public contract of the core (the only surface adapters consume).

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
  LoopStore,
  PlaybackEngine,
  SeparatedStem,
  SeparationProgress,
  StemSeparator,
  TrackMetadata,
  TrackMetadataReader
} from './application/ports.ts'
export type {
  SeparateTrackDeps,
  SeparateTrackInput,
  SeparateTrackResult
} from './application/separate-track.ts'
export { separateTrack } from './application/separate-track.ts'
export type {
  DetectedStem,
  StemEnergy
} from './domain/instrument-detection.ts'
export {
  detectInstruments,
  PRESENCE_THRESHOLD,
  stemEnergy
} from './domain/instrument-detection.ts'
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
export type { Marker } from './domain/marker.ts'
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
export type {
  SeparationAction,
  SeparationPhase,
  SeparationState,
  SeparationStatus
} from './domain/separation.ts'
export { initialSeparation, separationReducer } from './domain/separation.ts'
export type { StemSet, StemTrack } from './domain/stem-set.ts'
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
export { decodeWav } from './domain/wav-decoder.ts'
export { encodeWav } from './domain/wav-encoder.ts'
export type { Waveform, WaveformPeak } from './domain/waveform.ts'
