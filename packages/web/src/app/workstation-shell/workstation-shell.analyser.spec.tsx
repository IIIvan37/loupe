// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

/**
 * Q.2 — the four analysis actions (separate, tempo, structure, chords) form
 * ONE row at the head of the Analyse zone, instead of being scattered across
 * the markers row, the chord panel and a lone separation panel. Each action
 * keeps its accessible name, so the flows' own specs keep passing — these
 * tests pin down WHERE the actions live.
 */
describe('WorkstationShell analyser row', () => {
  it('groups the four analysis actions inside the Analyse zone', async () => {
    const { user } = renderShell()
    await importTrack(user)

    const analysis = screen.getByRole('region', {
      name: i18n._('shell.zone.analysis')
    })
    expect(
      within(analysis).getByRole('button', {
        name: i18n._('separation.separate')
      })
    ).toBeInTheDocument()
    expect(
      within(analysis).getByRole('button', {
        name: i18n._('structure.detect')
      })
    ).toBeInTheDocument()
    expect(
      within(analysis).getByRole('button', { name: i18n._('chords.detect') })
    ).toBeInTheDocument()
  })

  it('removes the detection buttons from the timeline and chart zones', async () => {
    const { user } = renderShell()
    await importTrack(user)

    const timeline = screen.getByRole('region', {
      name: i18n._('shell.zone.timeline')
    })
    expect(
      within(timeline).queryByRole('button', {
        name: i18n._('structure.detect')
      })
    ).not.toBeInTheDocument()

    const chart = screen.getByRole('region', {
      name: i18n._('shell.zone.chart')
    })
    expect(
      within(chart).queryByRole('button', { name: i18n._('chords.detect') })
    ).not.toBeInTheDocument()
  })
})

/**
 * Offload-only (Lot AJ): every analysis runs on the remote service, so the
 * only gate is the network — no local health probe, no « démarrer le serveur »
 * remedy. Being offline blocks the analyses (M1.4); the chords action still
 * needs a beat grid (unit-covered at the row level).
 */
describe('WorkstationShell analyse gating', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('blocks the offloaded analyses when the browser goes offline (M1.4)', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const { user } = renderShell()
    await importTrack(user)

    const gauge = vi.spyOn(window.navigator, 'onLine', 'get')
    gauge.mockReturnValue(false)
    fireEvent(window, new Event('offline'))

    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeDisabled()
    expect(
      screen.getAllByText(i18n._('analysis.blocked-offline')).length
    ).toBeGreaterThanOrEqual(2)

    // The network coming back lifts the block — no reload needed.
    gauge.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeEnabled()
    gauge.mockRestore()
  })

  it('enables chords once a detected tempo seats the grid (M1.1)', async () => {
    // The no-grid guard is the only thing gating chords: a resolving tempo
    // fake seats a downbeat grid, which lifts it.
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const { user } = renderShell({
      tempoDetector: {
        detect: async () => ({ bpm: 240, beats: beatsAt([0, 0.25, 0.5, 0.75]) })
      }
    })
    await importTrack(user)

    // In offload mode the import no longer auto-mints (AG.1): the tempo item
    // waits on offer, and the FIRST analysis gesture is the user's.
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('analyser.tempo-detect')
      })
    )
    // Wait for the detected tempo to seat the grid before asserting chords lift.
    expect(
      await screen.findByText(i18n._('analyser.tempo-done'), {
        ignore: 'script, style, output, [role="status"]'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    ).toBeEnabled()
  })
})
