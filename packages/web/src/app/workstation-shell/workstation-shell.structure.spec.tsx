// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { DetectedSection, StructureDetector } from '@app/core'
import { screen, waitFor } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  chartEditor,
  healthFetch,
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

/** A structure detector answering with the given sections. */
function detectorOf(sections: readonly DetectedSection[]): StructureDetector {
  return { detect: async () => sections }
}

const SECTIONS: DetectedSection[] = [
  { startSeconds: 0, endSeconds: 3, label: 'intro' },
  { startSeconds: 3, endSeconds: 7, label: 'verse' },
  { startSeconds: 7, endSeconds: 10, label: 'chorus' }
]

/** The « Détecter la structure » button, enabled once the server answers. */
async function detectButton(): Promise<HTMLElement> {
  const button = await screen.findByRole('button', {
    name: i18n._('structure.detect')
  })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

describe('WorkstationShell structure detection', () => {
  it('places translated section markers, no chord grid required', async () => {
    const { user } = renderShell({
      // Device answer → the server is up, so the button is not blocked. The
      // tempo detector never resolves (kit default), so the grid stays empty —
      // structure detection must still place markers.
      healthFetch: healthFetch(null),
      structureDetector: detectorOf(SECTIONS)
    })
    await importTrack(user)

    await user.click(await detectButton())

    // Each raw engine label is translated to its display copy and pinned as a
    // marker (shown in the rail and the analysis-panel list).
    for (const id of [
      'structure.section.intro',
      'structure.section.verse',
      'structure.section.chorus'
    ]) {
      expect((await screen.findAllByText(i18n._(id))).length).toBeGreaterThan(0)
    }
  })

  it('confirms before replacing markers a previous run placed', async () => {
    const { user } = renderShell({
      healthFetch: healthFetch(null),
      structureDetector: detectorOf(SECTIONS)
    })
    await importTrack(user)

    await user.click(await detectButton())
    // The markers now exist, so the next detection is armed work.
    await screen.findAllByText(i18n._('structure.section.verse'))

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    // First click only swaps the button to « Remplacer les repères ? ».
    const confirm = await screen.findByRole('button', {
      name: i18n._('structure.detect-confirm')
    })
    await user.click(confirm)

    // Confirming re-runs the detection — the sections are back.
    expect(
      (await screen.findAllByText(i18n._('structure.section.chorus'))).length
    ).toBeGreaterThan(0)
  })

  it('relabels an existing grid with the detected section names', async () => {
    const { user } = renderShell({
      healthFetch: healthFetch(null),
      // Bar = 1 s (240 BPM, four beats a bar, a downbeat every second) so the
      // section start times land on measure boundaries: verse at 0 → measure 0,
      // chorus at 4 s → measure 4. The fake grid is the beats verbatim, so they
      // must be dense enough to carry a downbeat per measure.
      tempoDetector: {
        detect: async () => ({
          bpm: 240,
          beats: beatsAt(Array.from({ length: 32 }, (_, i) => i * 0.25))
        })
      },
      structureDetector: detectorOf([
        { startSeconds: 0, endSeconds: 4, label: 'verse' },
        { startSeconds: 4, endSeconds: 8, label: 'chorus' }
      ])
    })
    await importTrack(user)
    // Two four-bar phrases the detection will cut into a verse and a chorus.
    const editor = await chartEditor(user)
    await user.type(editor, '| C | Am | F | G |{enter}| C | Am | F | G |')

    // A grid exists → detecting is armed work; the confirm names the grid.
    await user.click(await detectButton())
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('structure.detect-confirm-grid')
      })
    )

    // The neutral draft headers give way to the translated section names,
    // chords untouched, wrapped at the stored four-bar layout.
    await waitFor(() => {
      expect(editor).toHaveValue(
        `[${i18n._('structure.section.verse')}]\n| C | Am | F | G |\n\n` +
          `[${i18n._('structure.section.chorus')}]\n| C | Am | F | G |`
      )
    })
  })

  it('announces when no structure is found, placing no markers', async () => {
    const { user } = renderShell({
      healthFetch: healthFetch(null),
      structureDetector: detectorOf([])
    })
    await importTrack(user)

    await user.click(await detectButton())

    // Shown in the visible line AND spoken through the live region.
    expect(
      (
        await screen.findAllByText(
          `${i18n._('structure.detect-failed')} — ${i18n._('structure.error.no-structure')}`
        )
      ).length
    ).toBeGreaterThan(0)
  })
})
