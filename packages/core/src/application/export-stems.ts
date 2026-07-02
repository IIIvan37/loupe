import { padChannels, stemExportFilename } from '../domain/stem-export.ts'
import { encodeWav } from '../domain/wav-encoder.ts'
import { errorMessage } from './error-message.ts'
import type { ArchiveWriter, SeparatedStem } from './ports.ts'

export interface ExportStemsInput {
  /**
   * The stems to export, in display order — the caller decides which (e.g. only
   * the ones detection kept); numbering follows this order.
   */
  readonly stems: readonly SeparatedStem[]
}

export interface ExportStemsDeps {
  readonly archive: ArchiveWriter
}

export type ExportStemsResult =
  | { readonly ok: true; readonly archive: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly error: string }

/**
 * Export — tier A (plan produit §3.7): turn the separated stems into an aligned
 * stem folder. Every stem is encoded as a numbered 16-bit WAV (`01_Voix.wav`…)
 * padded to the longest stem, so all files share t=0 and one duration, then
 * bundled by the `ArchiveWriter` port into the archive the caller downloads.
 * Expected failures are a `Result`, not an exception.
 */
export async function exportStems(
  input: ExportStemsInput,
  deps: ExportStemsDeps
): Promise<ExportStemsResult> {
  const { stems } = input
  const first = stems[0]
  if (!first) {
    return { ok: false, error: 'No stems to export' }
  }
  if (stems.some((s) => s.audio.sampleRate !== first.audio.sampleRate)) {
    return { ok: false, error: 'Stems have mismatched sample rates' }
  }
  try {
    const frames = Math.max(
      ...stems.map((s) => s.audio.channels[0]?.length ?? 0)
    )
    const files = stems.map((stem, index) => ({
      name: stemExportFilename(index, stem.label),
      bytes: encodeWav(
        padChannels(stem.audio.channels, frames),
        stem.audio.sampleRate
      )
    }))
    return { ok: true, archive: await deps.archive.write(files) }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
