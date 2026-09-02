import { encodeWav, synthesizeClickTrack } from '@app/core'
import { useLingui } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { downloadBlob } from '../../../audio/download-blob.ts'
import { encodeWavMemo } from '../../../audio/encode/encode-wav-memo.ts'
import { exportBaseName } from '../../../lib/export-base-name.ts'
import { nextPaint } from '../../../lib/next-paint.ts'
import { METRONOME_ID } from '../../mixer/synthetic-stem.ts'
import { TRACK_STEM_ID } from '../../mixer/track-stem.ts'
import type { Separation } from '../../separation/use-separation.ts'
import type { Tempo } from '../../tempo/use-tempo.ts'
import { loadedAudioAtom } from '../../track/track-atoms.ts'

interface StemExportDeps {
  readonly separation: Separation
  readonly tempo: Tempo
  readonly metadata: { readonly title: string | undefined }
  readonly trackName: string | null
  readonly durationSeconds: number
  /** Raise the "it worked" confirmation once a file has actually downloaded. */
  readonly notifySuccess: (message: string) => void
}

export interface StemExport {
  /** Export ALL present stems as one zip — shared by the header and the mixer. */
  readonly exportStems: () => Promise<void>
  /** Whether the zip is being built — narrated by the header's busy line. */
  readonly exporting: boolean
  /**
   * Download one mixer lane as a WAV. The synthetic lanes (the click, and the
   * whole track when un-separated) are rendered on the fly; a separated stem
   * defers to the separation's own numbered download. Confirms only once a
   * file was actually delivered (a cancelled desktop save dialog stays mute).
   */
  readonly downloadStem: (id: string) => Promise<void>
}

/**
 * Owns the two stem-export entry points and their success feedback, off the
 * shell so the top-level component stays readable. Both confirm with a toast —
 * the browser's own download UI is easy to miss, so a visible "it worked" makes
 * the outcome explicit.
 */
export function useStemExport({
  separation,
  tempo,
  metadata,
  trackName,
  durationSeconds,
  notifySuccess
}: StemExportDeps): StemExport {
  const { t } = useLingui()
  // The track is the player feature's atom (ADR 0010): the synthetic lanes
  // (click, whole track) render from it.
  const loadedAudio = useAtomValue(loadedAudioAtom)
  const [exporting, setExporting] = useState(false)
  const stemsExportedMessage = t({
    id: 'toast.stems-exported',
    message: 'Pistes exportées'
  })
  const fileExportedMessage = t({
    id: 'toast.file-exported',
    message: 'Fichier exporté'
  })

  async function exportStems(): Promise<void> {
    // The zip is synchronous on the main thread (~seconds on a full track,
    // the off-thread rewrite stays on the watch list): paint the busy line
    // FIRST, or nothing shows until the toast (R.4).
    setExporting(true)
    await nextPaint()
    try {
      const ok = await separation.exportStems(
        exportBaseName(metadata.title, trackName)
      )
      if (ok) {
        notifySuccess(stemsExportedMessage)
      }
    } finally {
      setExporting(false)
    }
  }

  async function downloadStem(id: string): Promise<void> {
    const base = exportBaseName(metadata.title, trackName)
    if (id === METRONOME_ID && tempo.analysis && loadedAudio) {
      const samples = synthesizeClickTrack({
        beats: tempo.analysis.grid,
        durationSeconds,
        sampleRate: loadedAudio.sampleRate
      })
      const wav = encodeWav([samples], loadedAudio.sampleRate)
      downloadBlob(
        `${base}_metronome.wav`,
        new Blob([wav], { type: 'audio/wav' })
      )
      notifySuccess(fileExportedMessage)
      return
    }
    if (id === TRACK_STEM_ID && loadedAudio) {
      const wav = encodeWavMemo(loadedAudio)
      downloadBlob(`${base}_piste.wav`, new Blob([wav], { type: 'audio/wav' }))
      notifySuccess(fileExportedMessage)
      return
    }
    if (await separation.downloadStem(id)) {
      notifySuccess(fileExportedMessage)
    }
  }

  return { exportStems, downloadStem, exporting }
}
