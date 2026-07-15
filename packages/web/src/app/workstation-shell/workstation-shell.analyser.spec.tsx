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
