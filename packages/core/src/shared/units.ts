/**
 * Branded unit scalars — the fix for « aucune quantité n'est typée » (design
 * review 2026-08-03). A brand is a compile-time tag on `number`: zero runtime
 * cost, and the typechecker refuses a bare number (or the WRONG unit) where a
 * branded one is expected. The constructors below tag a value's DIMENSION;
 * they do not validate its range — range policy stays in the domain clamps
 * (`clampGainDb`, `clampTempoPercent`, …), which parse raw boundary input
 * into branded values (« parse, don't validate »).
 *
 * Unit algebra lives in named conversions (`percentToRatio`), never in inline
 * arithmetic: the speed-trainer's percent/ratio bug was a conversion assumed
 * to be an identity. Adding a unit = one type alias + one constructor here,
 * plus its conversions.
 */

declare const unit: unique symbol
type Unit<Name extends string> = number & { readonly [unit]: Name }

/** Audio-timeline time. NOT interchangeable with a 0…1 progress ratio. */
export type Seconds = Unit<'seconds'>
/** Dimensionless multiplier (1 = identity) — playback rate, progress. */
export type Ratio = Unit<'ratio'>
/** The same quantity in the controls' grain (100 = identity). */
export type Percent = Unit<'percent'>
/** Logarithmic gain (0 = unity). Never add to a linear gain ratio. */
export type Decibels = Unit<'decibels'>
/** Hundredths of a semitone (fine-tune grain). */
export type Cents = Unit<'cents'>
/** Equal-tempered pitch class, an integer 0 (C) … 11 (B). */
export type PitchClass = Unit<'pitch-class'>

export const seconds = (value: number): Seconds => value as Seconds
export const ratio = (value: number): Ratio => value as Ratio
export const percent = (value: number): Percent => value as Percent
export const decibels = (value: number): Decibels => value as Decibels
export const cents = (value: number): Cents => value as Cents

/** One percent of identity, the controls' grain. */
const PERCENT_PER_UNIT = 100

export const percentToRatio = (value: Percent): Ratio =>
  ratio(value / PERCENT_PER_UNIT)

export const ratioToPercent = (value: Ratio): Percent =>
  percent(value * PERCENT_PER_UNIT)

/** Classes per octave — 12-TET, the only temperament in the app. */
const SEMITONES_PER_OCTAVE = 12

/**
 * Wrap a semitone count (interval, MIDI note, transposition) onto its pitch
 * class. THE one modulo-12 in the codebase (`units.spec.ts` at the core root
 * bans the literal elsewhere): a hand-rolled wrap yields a `number` where a
 * `PitchClass` is required, so the typechecker points back here. Fractional
 * input rounds to the nearest semitone first.
 */
export const pitchClass = (semitones: number): PitchClass => {
  const wrapped =
    ((Math.round(semitones) % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) %
    SEMITONES_PER_OCTAVE
  return wrapped as PitchClass
}

/** MIDI note number of A440 — the 12-TET anchor. */
const A440_MIDI = 69
const A440_HZ = 440

/** Pitch class of a frequency; midi % 12 puts C at 0 (A440 = midi 69). */
export const pitchClassOfHz = (hz: number): PitchClass =>
  pitchClass(SEMITONES_PER_OCTAVE * Math.log2(hz / A440_HZ) + A440_MIDI)
