/**
 * The reserved design-system colour for each stem, as a CSS custom-property
 * name (teal as a fallback for an unknown id). A name rather than a `var(...)`
 * so the waveform canvas can resolve it with `getComputedStyle`; wrap it with
 * `stemColor` for a CSS value.
 */
const STEM_COLOR_VAR: Readonly<Record<string, string>> = {
  voix: '--stem-vocals',
  batterie: '--stem-drums',
  basse: '--stem-bass',
  // The htdemucs « other » bucket (everything that is not voice/drums/bass).
  autres: '--stem-other',
  guitare: '--stem-guitar',
  claviers: '--stem-keys',
  // Synthetic stems: the whole track (un-separated) and the metronome click.
  piste: '--teal',
  metronome: '--amber'
}

/** The CSS custom-property name for a stem's colour (`--teal` as a fallback). */
export function stemColorVar(id: string): string {
  return STEM_COLOR_VAR[id] ?? '--teal'
}

/** The stem's colour as a ready-to-use CSS value (`var(--stem-…)`). */
export function stemColor(id: string): string {
  return `var(${stemColorVar(id)})`
}
