import type { Project } from './project.ts'

/**
 * Runtime decoder for a persisted project manifest (AA.2). Adapters read
 * manifests from places the user can hand-edit (a JSON file on disk, a local
 * server that persists verbatim), so the `as Project` cast is a lie the first
 * time a file is corrupt — at best a crash deep in restore, at worst a
 * half-coherent session. This guard checks every load-bearing field and
 * returns the manifest verbatim (same reference — a re-save stays
 * byte-identical) or `undefined` for « unreadable ».
 *
 * Deliberately lenient where a per-field normalizer already reads corruption
 * as a default (`fineTuneCents`, `chordChart.transposedBy`, marker `kind`):
 * rejecting there would make that leniency dead code. Unknown extra fields
 * pass through untouched.
 */
export function parseProject(value: unknown): Project | undefined {
  if (!isRecord(value) || Array.isArray(value)) {
    return undefined
  }
  const valid =
    isNonEmptyString(value.id) &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt) &&
    isValidSource(value.source) &&
    isArrayOf(value.loops, isValidLoop) &&
    isArrayOf(value.markers, isValidMarker) &&
    isAbsentOr(value.activeLoop, isValidActiveLoop) &&
    isAbsentOr(value.tuning, isValidTuning) &&
    isAbsentOr(value.tempo, isValidTempo) &&
    isAbsentOr(value.chordChart, isValidChordChart) &&
    isAbsentOr(value.separation, isValidSeparation)
  return valid ? (value as unknown as Project) : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isAbsentOr(
  value: unknown,
  check: (value: unknown) => boolean
): boolean {
  return value === undefined || check(value)
}

function isArrayOf(
  value: unknown,
  check: (element: unknown) => boolean
): boolean {
  return Array.isArray(value) && value.every(check)
}

function isValidSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.audioRef) &&
    isOptionalString(value.title) &&
    isOptionalString(value.artist)
  )
}

function isValidRegion(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.startSeconds) &&
    isFiniteNumber(value.endSeconds)
  )
}

function isValidLoop(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.name === 'string' &&
    isValidRegion(value.region)
  )
}

function isValidMarker(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.timeSeconds) &&
    typeof value.label === 'string'
  )
}

function isValidActiveLoop(value: unknown): boolean {
  return (
    isRecord(value) &&
    isValidRegion(value.region) &&
    typeof value.enabled === 'boolean'
  )
}

function isValidTuning(value: unknown): boolean {
  // fineTuneCents is left unchecked: `fineTuneOrDefault` already clamps
  // corruption to 0 through the clamp's NaN contract.
  return (
    isRecord(value) &&
    isFiniteNumber(value.timeRatio) &&
    isFiniteNumber(value.pitchSemitones) &&
    isFiniteNumber(value.zoom)
  )
}

function isValidBeat(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.timeSeconds) &&
    typeof value.downbeat === 'boolean'
  )
}

function isValidMixerChannel(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.gainDb) &&
    typeof value.muted === 'boolean' &&
    typeof value.soloed === 'boolean'
  )
}

function isValidManualTempo(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.bpm) &&
    isFiniteNumber(value.phaseSeconds)
  )
}

function isValidTempo(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.bpm) &&
    isArrayOf(value.grid, isValidBeat) &&
    isValidMixerChannel(value.metronome) &&
    isAbsentOr(value.beatsPerBar, isFiniteNumber) &&
    isAbsentOr(value.octaveShift, isFiniteNumber) &&
    isAbsentOr(value.manual, isValidManualTempo)
  )
}

function isValidChordChart(value: unknown): boolean {
  // transposedBy is left unchecked: `chartTransposedBy` reads corruption as 0.
  return isRecord(value) && typeof value.source === 'string'
}

function isValidStem(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.label === 'string' &&
    isNonEmptyString(value.audioRef)
  )
}

function isValidSeparation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isArrayOf(value.stems, isValidStem) &&
    isArrayOf(value.mixer, isValidMixerChannel)
  )
}
