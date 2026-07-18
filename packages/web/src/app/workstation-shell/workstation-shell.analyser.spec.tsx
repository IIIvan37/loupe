// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  healthFetch,
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
 * X.1 — the structure engine runs wherever ANALYSIS_URL points. The local
 * health probe only gates it when the analysis IS local; on the offload the
 * button stays actionable (no probe of the Modal endpoint — a page-load probe
 * would cold-start the billed container) and a failure speaks at click time
 * with the offload's own words.
 */
describe('WorkstationShell structure gating vs the local server', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('blocks structure on local health when the analysis is local', async () => {
    const { user } = renderShell({ healthFetch: healthFetch('unreachable') })
    await importTrack(user)

    expect(
      await screen.findByText(i18n._('structure.detect-needs-server'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeDisabled()
  })

  it('keeps structure actionable despite local health in offload mode', async () => {
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const { user } = renderShell({ healthFetch: healthFetch('unreachable') })
    await importTrack(user)

    // The header chip still reflects the LOCAL server (storage stays local):
    // it is the signal that the health probe has settled to offline.
    expect(
      await screen.findByText(i18n._('header.server-offline'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n._('structure.detect-needs-server'))
    ).not.toBeInTheDocument()
  })

  it('keeps separation actionable despite local health in offload mode (M1.3)', async () => {
    // Separation runs on the offload with the three detections now — the
    // local health probe must not gate it, and « démarrer le serveur local »
    // would be the wrong remedy.
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const { user } = renderShell({ healthFetch: healthFetch('unreachable') })
    await importTrack(user)

    expect(
      await screen.findByText(i18n._('header.server-offline'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n._('separation.server-offline'))
    ).not.toBeInTheDocument()
  })

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

  it('keeps chords actionable despite local health in offload mode (M1.1)', async () => {
    // Chords run on the offload with structure and tempo now — the local
    // health probe must not gate them either (the no-grid guard still does,
    // hence a resolving tempo fake: the grid must exist to isolate 'server').
    vi.stubEnv('VITE_STRUCTURE_URL', 'https://modal.example')
    const { user } = renderShell({
      healthFetch: healthFetch('unreachable'),
      tempoDetector: {
        detect: async () => ({ bpm: 240, beats: beatsAt([0, 0.25, 0.5, 0.75]) })
      }
    })
    await importTrack(user)

    expect(
      await screen.findByText(i18n._('header.server-offline'))
    ).toBeInTheDocument()
    // In offload mode the import no longer auto-mints (AG.1): the tempo item
    // waits on offer, and the FIRST analysis gesture is the user's.
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('analyser.tempo-detect')
      })
    )
    // The no-grid guard still applies — wait for the detected tempo to seat
    // the grid before asserting the health probe no longer blocks.
    expect(
      await screen.findByText(i18n._('analyser.tempo-done'), {
        ignore: 'script, style, output, [role="status"]'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('chords.detect') })
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n._('chords.detect-needs-server'))
    ).not.toBeInTheDocument()
  })
})
