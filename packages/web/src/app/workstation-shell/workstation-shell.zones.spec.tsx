// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

/**
 * Q.1 — the main column is composed of three named zones (Timeline, Analyse,
 * Partition) instead of a flat pile of sibling panels. Each zone is a labelled
 * region so the structure is real for AT, not just visual spacing.
 */
describe('WorkstationShell zones', () => {
  it('groups the loaded workstation into three named zones', async () => {
    const { user } = renderShell()
    await importTrack(user)

    const timeline = screen.getByRole('region', {
      name: i18n._('shell.zone.timeline')
    })
    const analysis = screen.getByRole('region', {
      name: i18n._('shell.zone.analysis')
    })
    const chart = screen.getByRole('region', {
      name: i18n._('shell.zone.chart')
    })

    // Timeline: the markers row and the waveform stage live together.
    expect(
      within(timeline).getByRole('button', { name: i18n._('markers.add') })
    ).toBeInTheDocument()
    expect(
      within(timeline).getByRole('button', {
        name: i18n._('waveform.surface')
      })
    ).toBeInTheDocument()

    // Analyse: separation and tempo are one phase, side by side.
    expect(
      within(analysis).getByRole('button', {
        name: i18n._('separation.separate')
      })
    ).toBeInTheDocument()
    expect(
      within(analysis).getByRole('region', {
        name: i18n._('tempo.region-label')
      })
    ).toBeInTheDocument()

    // Partition: the chord chart panel.
    expect(
      within(chart).getByRole('heading', { name: i18n._('chords.title') })
    ).toBeInTheDocument()
  })

  it('labels every zone and row with the same section-label voice', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // The separation row finally carries a visible label, like its siblings.
    expect(
      screen.getByText(i18n._('separation.section-label'))
    ).toBeInTheDocument()
  })
})
