// Public contract of the core (the only surface adapters consume).

export type {
  DetectTempoDeps,
  DetectTempoInput,
  DetectTempoResult,
  TempoAnalysis
} from './application/detect-tempo.ts'
export { detectTempo } from './application/detect-tempo.ts'
export type {
  ExportStemsDeps,
  ExportStemsInput,
  ExportStemsResult
} from './application/export-stems.ts'
export { exportStems } from './application/export-stems.ts'
export type {
  ImportFromUrlDeps,
  ImportFromUrlInput,
  ImportFromUrlResult
} from './application/import-from-url.ts'
export { importFromUrl } from './application/import-from-url.ts'
export type {
  LoadTrackDeps,
  LoadTrackInput,
  LoadTrackResult
} from './application/load-track.ts'
export { loadTrack } from './application/load-track.ts'
export type {
  ArchiveFile,
  ArchiveWriter,
  AudioFileDecoder,
  DecodedAudio,
  DetectedTempo,
  DownloadProgress,
  FetchedTrack,
  PlaybackEngine,
  ProjectAudioStore,
  ProjectStore,
  SeparatedStem,
  SeparationProgress,
  StemPlaybackEngine,
  StemSeparator,
  StemSource,
  TempoDetector,
  TrackMetadata,
  TrackMetadataReader,
  TrackSource,
  TrackSourceMetadata
} from './application/ports.ts'
export type {
  DeleteProjectResult,
  ListProjectsResult,
  OpenedStem,
  OpenProjectResult,
  ProjectDeps,
  RenameProjectResult,
  SaveProjectInput,
  SaveProjectResult,
  SaveProjectStem
} from './application/projects.ts'
export {
  deleteProject,
  listProjects,
  openProject,
  renameProject,
  saveProject
} from './application/projects.ts'
export type {
  SeparateTrackDeps,
  SeparateTrackInput,
  SeparateTrackResult
} from './application/separate-track.ts'
export { separateTrack } from './application/separate-track.ts'
export { isSupportedSourceUrl } from './application/supported-source.ts'
export type {
  ChordChart,
  Measure,
  Section
} from './domain/chord-chart.ts'
export { parseChart, transposeChartSource } from './domain/chord-chart.ts'
export type { ChordSymbol } from './domain/chord-symbol.ts'
export { formatChordSymbol } from './domain/chord-symbol.ts'
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
  moveMarker,
  removeMarker
} from './domain/marker-list.ts'
export type { ClickTrackOptions, CountIn } from './domain/metronome.ts'
export { buildCountIn, synthesizeClickTrack } from './domain/metronome.ts'
export type {
  ChannelGain,
  MixerAction,
  MixerChannel,
  MixerState
} from './domain/mixer.ts'
export {
  clampGainDb,
  dbToAmplitude,
  effectiveGains,
  emptyMixer,
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  mixerReducer,
  UNITY_GAIN_DB
} from './domain/mixer.ts'
export {
  clampPitchSemitones,
  MAX_PITCH_SEMITONES,
  MIN_PITCH_SEMITONES
} from './domain/pitch-shift.ts'
export {
  clampPlaybackRate,
  MAX_PLAYBACK_RATE,
  MAX_TEMPO_PERCENT,
  MIN_PLAYBACK_RATE,
  MIN_TEMPO_PERCENT
} from './domain/playback-rate.ts'
export type {
  AudioRef,
  Project,
  ProjectActiveLoop,
  ProjectChordChart,
  ProjectSeparation,
  ProjectSource,
  ProjectStamp,
  ProjectStem,
  ProjectTempo,
  ProjectTuning,
  SessionSnapshot
} from './domain/project.ts'
export { projectFromSession, tuningOrDefault } from './domain/project.ts'
export type {
  SeparationAction,
  SeparationPhase,
  SeparationState,
  SeparationStatus
} from './domain/separation.ts'
export { initialSeparation, separationReducer } from './domain/separation.ts'
export type {
  SpeedTrainerPolicy,
  SpeedTrainerState
} from './domain/speed-trainer.ts'
export {
  completesLoopPass,
  recordLoopPass,
  startSpeedTrainer
} from './domain/speed-trainer.ts'
export { stemExportFilename } from './domain/stem-export.ts'
export type { StemSet, StemTrack } from './domain/stem-set.ts'
export { buildStemTrack } from './domain/stem-set.ts'
export type {
  Beat,
  BeatGrid,
  DetectedBeat,
  ManualTempo,
  OctaveFactor,
  TempoMap,
  TempoSegment,
  TempoValue
} from './domain/tempo.ts'
export {
  appendTap,
  buildManualGrid,
  buildTempoMap,
  DEFAULT_BEATS_PER_BAR,
  detectMeter,
  foldTempoOctave,
  MAX_MANUAL_BPM,
  MIN_MANUAL_BPM,
  normalizeManualBpm,
  tapTempoBpm,
  tempoAt
} from './domain/tempo.ts'
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
export type { WaveformLayer } from './domain/waveform-mix.ts'
export { combineWaveforms } from './domain/waveform-mix.ts'
