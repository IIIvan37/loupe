// Public contract of the core (the only surface adapters consume).

export type {
  ChordDetectionErrorCode,
  DetectChordsDeps,
  DetectChordsInput,
  DetectChordsResult
} from './application/detect-chords.ts'
export {
  ChordDetectionError,
  detectChords
} from './application/detect-chords.ts'
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
  AudioFileDecoder,
  ChordDetector,
  DownloadProgress,
  FetchedTrack,
  PlaybackEngine,
  ProjectAudioStore,
  ProjectStore,
  SpectrumFrame,
  StemFilter,
  StemPlaybackEngine,
  StemSource,
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
export { isSupportedSourceUrl } from './application/supported-source.ts'
export { downmixToMono } from './audio/domain/downmix.ts'
export { spectrumFromSamples } from './audio/domain/spectrum.ts'
export type { Track } from './audio/domain/track.ts'
export { decodeWav } from './audio/domain/wav-decoder.ts'
export { encodeWav } from './audio/domain/wav-encoder.ts'
export type { Waveform, WaveformPeak } from './audio/domain/waveform.ts'
export { bassNotePerMeasure } from './domain/bass-line.ts'
export {
  clampFineTuneCents,
  fineTuneOrDefault,
  MAX_FINE_TUNE_CENTS,
  MIN_FINE_TUNE_CENTS
} from './domain/fine-tune.ts'
export type {
  Command,
  KeyBinding,
  KeyBindings,
  KeyChord
} from './domain/key-bindings.ts'
export {
  defaultKeyBindings,
  resolveCommand
} from './domain/key-bindings.ts'
export { parseProject } from './domain/parse-project.ts'
export {
  clampPitchSemitones,
  MAX_PITCH_SEMITONES,
  MIN_PITCH_SEMITONES,
  stepPitchSemitones
} from './domain/pitch-shift.ts'
export {
  clampPlaybackRate,
  MAX_TEMPO_PERCENT,
  MIN_TEMPO_PERCENT,
  stepTempoPercent
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
export {
  chartTransposedBy,
  projectChordChart,
  tuningOrDefault
} from './domain/project.ts'
export { seekStepSeconds } from './domain/seek-step.ts'
export type {
  SpeedTrainerPolicy,
  SpeedTrainerPreview,
  SpeedTrainerState
} from './domain/speed-trainer.ts'
export {
  completesLoopPass,
  previewSpeedTrainer,
  recordLoopPass,
  startSpeedTrainer
} from './domain/speed-trainer.ts'
export { formatTimecode } from './domain/timecode.ts'
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
export type {
  ChartDiagnostics,
  ChartForm,
  ChordChart,
  Measure,
  MeasureSourceSpan,
  Section,
  SuspectToken
} from './harmony/domain/chord-chart.ts'
export {
  chartDiagnostics,
  chartMatchesPitch,
  parseChart,
  parseFormRollout,
  respellChartSource,
  transposeChart,
  unrollChart
} from './harmony/domain/chord-chart.ts'
export type { DetectedChordSpan } from './harmony/domain/chord-detection.ts'
export {
  engraveChordSymbol,
  engraveNote
} from './harmony/domain/chord-engraving.ts'
export type { Key } from './harmony/domain/chord-key.ts'
export {
  keyName,
  parseKeyName,
  transposeKey
} from './harmony/domain/chord-key.ts'
export type { Accidental, ChordSymbol } from './harmony/domain/chord-symbol.ts'
export {
  formatChordSymbol,
  parseChordSymbol
} from './harmony/domain/chord-symbol.ts'
export { chromaWithHarmonics } from './harmony/domain/chroma.ts'
export { romanizeChordSymbol } from './harmony/domain/roman-numeral.ts'
export type { LoopLibrary, NamedLoop } from './loops/domain/loop-library.ts'
export {
  addLoop,
  emptyLoopLibrary,
  removeLoop
} from './loops/domain/loop-library.ts'
export type { LoopRegion } from './loops/domain/loop-region.ts'
export {
  loopLength,
  makeLoopRegion,
  wrapToLoop
} from './loops/domain/loop-region.ts'
export type { SnapUnit } from './loops/domain/snap-loop-region.ts'
export { snapLoopRegionToGrid } from './loops/domain/snap-loop-region.ts'
export type { Marker } from './markers/domain/marker.ts'
export type { MarkerList } from './markers/domain/marker-list.ts'
export {
  addMarker,
  emptyMarkerList,
  moveMarker,
  removeMarker,
  replaceStructureMarkers
} from './markers/domain/marker-list.ts'
export type {
  DetectTempoDeps,
  DetectTempoInput,
  DetectTempoResult,
  TempoAnalysis,
  TempoDetectionErrorCode
} from './rhythm/application/detect-tempo.ts'
export {
  detectTempo,
  TempoDetectionError
} from './rhythm/application/detect-tempo.ts'
export type {
  DetectedTempo,
  TempoDetector
} from './rhythm/application/ports.ts'
export type {
  Beat,
  BeatGrid,
  DetectedBeat,
  OctaveFactor,
  TempoValue
} from './rhythm/domain/beat-grid.ts'
export {
  DEFAULT_BEATS_PER_BAR,
  foldTempoOctave,
  MAX_BEATS_PER_BAR,
  measureIndexAt,
  remeterGrid
} from './rhythm/domain/beat-grid.ts'
export type { ManualTempo } from './rhythm/domain/manual-tempo.ts'
export {
  appendTap,
  buildManualGrid,
  MAX_MANUAL_BPM,
  MIN_MANUAL_BPM,
  normalizeManualBpm,
  tapTempoBpm
} from './rhythm/domain/manual-tempo.ts'
export type { ClickTrackOptions, CountIn } from './rhythm/domain/metronome.ts'
export {
  buildCountIn,
  synthesizeClickTrack
} from './rhythm/domain/metronome.ts'
export { nudgeSeconds } from './rhythm/domain/nudge-time.ts'
export type { TempoMap, TempoSegment } from './rhythm/domain/tempo-map.ts'
export {
  buildTempoMap,
  sanitizeBeatGrid,
  tempoAt
} from './rhythm/domain/tempo-map.ts'
export type {
  ExportStemsDeps,
  ExportStemsInput,
  ExportStemsResult
} from './separation/application/export-stems.ts'
export { exportStems } from './separation/application/export-stems.ts'
export type {
  ArchiveFile,
  ArchiveWriter,
  SeparatedStem,
  SeparationProgress,
  StemSeparator
} from './separation/application/ports.ts'
export type {
  SeparateTrackDeps,
  SeparateTrackInput,
  SeparateTrackResult
} from './separation/application/separate-track.ts'
export {
  SeparationError,
  separateTrack
} from './separation/application/separate-track.ts'
export { monoMixWithout } from './separation/domain/analysis-mix.ts'
export type {
  DetectedStem,
  StemEnergy
} from './separation/domain/instrument-detection.ts'
export type {
  ChannelGain,
  MixerAction,
  MixerChannel,
  MixerState
} from './separation/domain/mixer.ts'
export {
  effectiveGains,
  emptyMixer,
  MAX_GAIN_DB,
  MIN_GAIN_DB,
  mixerReducer,
  stepGainDb,
  UNITY_GAIN_DB
} from './separation/domain/mixer.ts'
export type {
  SeparationAction,
  SeparationErrorCode,
  SeparationFailure,
  SeparationPhase,
  SeparationState,
  SeparationStatus
} from './separation/domain/separation.ts'
export {
  initialSeparation,
  separationReducer
} from './separation/domain/separation.ts'
export { stemExportFilename } from './separation/domain/stem-export.ts'
export type { StemSet, StemTrack } from './separation/domain/stem-set.ts'
export { buildStemTrack } from './separation/domain/stem-set.ts'
export type { WaveformLayer } from './separation/domain/waveform-mix.ts'
export { combineWaveforms } from './separation/domain/waveform-mix.ts'
export type { DecodedAudio } from './shared/decoded-audio.ts'
export type {
  DetectStructureDeps,
  DetectStructureInput,
  DetectStructureResult,
  StructureDetectionErrorCode
} from './structure/application/detect-structure.ts'
export {
  detectStructure,
  StructureDetectionError
} from './structure/application/detect-structure.ts'
export type { StructureDetector } from './structure/application/ports.ts'
// chartSectionAnchors is the chart→timeline half of the marker sync: the web
// re-derives the structure markers from the edited source (chart = authority).
export type { SectionAnchor } from './structure/domain/chart-structure.ts'
// deduceStructure / renderStructuredSource stay internal to the detectChords
// use-case; relabelChartBySections is a chart-source transform (family of
// transposeChart / renderChartSource) the web applies with translated section
// headers, so it is public like the rest of the chart utilities.
export {
  chartSectionAnchors,
  measureSeekTime,
  relabelChartBySections
} from './structure/domain/chart-structure.ts'
export type { DetectedSection } from './structure/domain/song-structure.ts'
// snapSectionsToGrid stays internal to the detectStructure use-case — like the
// chord slice's chordLabelPerMeasure / deduceStructure folds, an adapter only
// ever consumes the use-case, never the domain fold.
