import type { SeparatedStem, StemSeparator } from '@app/core'

/**
 * The instrument lineup the stub pretends to find — the five stem colours the
 * design system reserves. A real adapter (Demucs WASM in Slice 2, a cloud API
 * later) will replace this behind the SAME `StemSeparator` port; only the labels
 * and PCM differ, never the contract.
 */
const STUB_STEMS: ReadonlyArray<{
  readonly id: string
  readonly label: string
}> = [
  { id: 'voix', label: 'Voix' },
  { id: 'batterie', label: 'Batterie' },
  { id: 'basse', label: 'Basse' },
  { id: 'guitare', label: 'Guitare' },
  { id: 'claviers', label: 'Claviers' }
]

const ANALYSE_STEPS = 4
const SEPARATE_STEPS = 5
const STEP_MS = 140

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Driven adapter for `StemSeparator`, UI-first stand-in: it emits a believable
 * analysing-then-separating progress curve, then returns fixed stems that REUSE
 * the loaded PCM (no real isolation yet). Lets the import → separation screen and
 * the port contract be built and reviewed before paying for the WASM engine.
 */
export function createStubSeparator(): StemSeparator {
  return {
    async separate(audio, onProgress) {
      for (let step = 1; step <= ANALYSE_STEPS; step++) {
        await delay(STEP_MS)
        onProgress({ phase: 'analysing', fraction: step / ANALYSE_STEPS })
      }
      for (let step = 1; step <= SEPARATE_STEPS; step++) {
        await delay(STEP_MS)
        onProgress({ phase: 'separating', fraction: step / SEPARATE_STEPS })
      }
      return STUB_STEMS.map(
        (stem): SeparatedStem => ({ id: stem.id, label: stem.label, audio })
      )
    }
  }
}
