import type { BeatGrid } from './beat-grid.ts'
import { formatChordSymbol, parseChordSymbol } from './chord-symbol.ts'
import { spectrumFromSamples } from './spectrum.ts'

/** The bass register: below E1 the FFT bins blur, above ~middle C a "bass"
 * peak is more likely a harmonic than the played bass note. */
const BASS_MIN_HZ = 38
const BASS_MAX_HZ = 262
/** FFT window over the bass stem — LONGER than the app's other spectra
 * (4096): at 44.1 kHz a 4096-point bin spans ~4 semitones around E1, useless
 * down there. 16384 points ≈ 2.7 Hz bins ≈ a semitone at the low edge, for
 * ~370 ms of signal — well inside any measure. */
const WINDOW = 16384
/** The dominant class must carry this much more energy than the runner-up
 * to call the measure's bass STABLE — below it, no slash is worth printing. */
const DOMINANCE = 2

/** Sharp spelling, matching the chord engine's — the key respell downstream
 * turns them flat when the key says so. */
const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const

/**
 * The stable bass pitch class of each measure of a bass stem — the slash
 * chords' ground truth (pre-beta 4b). Values in, values out: per measure
 * (downbeat → next downbeat), Hann-windowed FFTs folded onto the 12 classes
 * over the bass register only; the dominant class wins when it clearly beats
 * the runner-up, otherwise (weak, ambiguous, silent) the measure reads
 * undefined and prints no slash.
 */
export function bassNotePerMeasure(
  samples: ArrayLike<number>,
  sampleRate: number,
  grid: BeatGrid
): ReadonlyArray<number | undefined> {
  const downbeats = grid
    .filter((beat) => beat.downbeat)
    .map((beat) => beat.timeSeconds)
  // One measure PER downbeat — `chordLabelPerMeasure`'s convention: the
  // closing bar has no closing downbeat and extends by the previous bar's
  // length (a lone downbeat reads to the end of the signal). Anything
  // shorter leaves the labels' final row without a bass and the last
  // measure of every song silently never prints a slash.
  const last = downbeats.at(-1)
  if (last === undefined) {
    return []
  }
  const secondToLast = downbeats.at(-2)
  const lastBarEnd =
    secondToLast === undefined
      ? samples.length / sampleRate
      : last + (last - secondToLast)
  const notes: Array<number | undefined> = []
  for (let m = 0; m < downbeats.length; m++) {
    const startFrame = Math.floor((downbeats[m] as number) * sampleRate)
    const endFrame = Math.floor((downbeats[m + 1] ?? lastBarEnd) * sampleRate)
    notes.push(dominantBassClass(samples, sampleRate, startFrame, endFrame))
  }
  return notes
}

/** Scratch buffer reused across windows — ~276 window copies per song
 * otherwise churn ~50 MB of garbage in the middle of a synchronous block. */
const scratch = new Float32Array(WINDOW)

/**
 * The measure's dominant bass class: the strongest in-band spectral peak,
 * frequency refined by parabolic interpolation (a bin is a whole semitone
 * down here — the raw centre would mis-name off-bin notes), taken as the
 * strongest single window of up to three spread across the bar (the max,
 * not a sum — a note played late must not be diluted by the quiet start).
 * Contested when a DISTANT peak (leakage-free, > 3 bins away) rivals it in
 * any window — two competing notes print no slash.
 */
function dominantBassClass(
  samples: ArrayLike<number>,
  sampleRate: number,
  startFrame: number,
  endFrame: number
): number | undefined {
  const span = Math.max(0, endFrame - startFrame - WINDOW)
  const starts = [0, 1, 2].map((i) => startFrame + Math.floor((span * i) / 2))
  let bestMag = 0
  let bestHz = 0
  let rivalMag = 0
  for (const start of new Set(starts)) {
    const scan = scanWindow(samples, sampleRate, start)
    if (scan.magnitude > bestMag) {
      bestMag = scan.magnitude
      bestHz = scan.hz
    }
    rivalMag = Math.max(rivalMag, scan.rival)
  }
  // Near-silence or a contested measure prints no slash.
  if (bestMag <= 0 || bestMag < DOMINANCE * rivalMag) {
    return undefined
  }
  const midi = Math.round(12 * Math.log2(bestHz / 440) + 69)
  return ((midi % 12) + 12) % 12
}

/** One window's read: its in-band peak (magnitude + interpolated Hz) and the
 * strongest DISTANT rival (> 3 bins from the local peak, outside leakage). */
function scanWindow(
  samples: ArrayLike<number>,
  sampleRate: number,
  start: number
): { magnitude: number; hz: number; rival: number } {
  for (let i = 0; i < WINDOW; i++) {
    scratch[i] = Number(samples[start + i] ?? 0)
  }
  const { magnitudes } = spectrumFromSamples(scratch, sampleRate)
  const binHz = sampleRate / (2 * magnitudes.length)
  const low = Math.ceil(BASS_MIN_HZ / binHz)
  const high = Math.floor(BASS_MAX_HZ / binHz)
  let peak = low
  for (let i = low; i <= high; i++) {
    if ((magnitudes[i] ?? 0) > (magnitudes[peak] ?? 0)) {
      peak = i
    }
  }
  const magnitude = magnitudes[peak] ?? 0
  // Parabolic refinement over the peak and its neighbours.
  const left = magnitudes[peak - 1] ?? 0
  const right = magnitudes[peak + 1] ?? 0
  const denom = left - 2 * magnitude + right
  const shift = denom === 0 ? 0 : (0.5 * (left - right)) / denom
  let rival = 0
  for (let i = low; i <= high; i++) {
    if (Math.abs(i - peak) > 3 && (magnitudes[i] ?? 0) > rival) {
      rival = magnitudes[i] ?? 0
    }
  }
  return { magnitude, hz: (peak + shift) * binHz, rival }
}

/** The pitch class a SHARP-spelled root folds onto — the only spelling this
 * ever sees: `applyBassSlash` runs on the engine's labels, before the key
 * respell introduces any flat. */
function classOfName(name: string): number {
  const base = SHARP_NAMES.indexOf(
    (name[0] ?? '') as (typeof SHARP_NAMES)[number]
  )
  return name[1] === '#' ? (base + 1) % 12 : base
}

/**
 * Print the measured bass under each single-chord cell whose root it is not:
 * `C` + bass E → `C/E`. A two-chord cell keeps its face (whose bass would it
 * be?), an unstable measure prints nothing, a non-chord token (silence,
 * structural `X`) is never slashed. Sharp spelling — the key respell owns
 * flats downstream.
 */
export function applyBassSlash(
  labels: ReadonlyArray<string | undefined>,
  bassNotes: ReadonlyArray<number | undefined>
): ReadonlyArray<string | undefined> {
  return labels.map((label, measure) => {
    const bass = bassNotes[measure]
    // An empty measure (no chord heard) stays empty — nothing to slash.
    if (label === undefined || bass === undefined || label.includes(' ')) {
      return label
    }
    // Not a chord (silence `N.C.`, structural tokens): never slashed.
    if (!/^[A-G]/.test(label)) {
      return label
    }
    const symbol = parseChordSymbol(label)
    if (classOfName(symbol.root) === bass || symbol.bass !== undefined) {
      return label
    }
    return formatChordSymbol({
      ...symbol,
      bass: SHARP_NAMES[bass] as string
    })
  })
}
