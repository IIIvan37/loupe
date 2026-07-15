// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

/**
 * Q.3 — the Analyse zone folds: once the analyses are acquired, practice
 * needs the timeline and the chart, not the tooling. The folded header keeps
 * a summary of what the machine acquired; the manual choice persists.
 */
describe('WorkstationShell analysis fold', () => {
  it('starts unfolded on a fresh import and folds on demand', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1, 1.5]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // Fresh import = analysis time: the zone opens with its actions offered.
    const disclosure = screen.getByRole('button', {
      name: i18n._('shell.zone.analysis'),
      expanded: true
    })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeInTheDocument()

    await user.click(disclosure)
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
    // The manual choice is remembered for the next session.
    expect(localStorage.getItem('loupe.analyser.open')).toBe('false')
  })

  it('summarises the acquired analyses in the folded header', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1, 1.5]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: i18n._('shell.zone.analysis'),
          expanded: true
        })
      ).toBeInTheDocument()
    })

    await user.click(
      screen.getByRole('button', { name: i18n._('shell.zone.analysis') })
    )
    const analysis = screen.getByRole('region', {
      name: i18n._('shell.zone.analysis')
    })
    // The folded content stays in the DOM (hidden — aria-controls must
    // resolve), so text queries can hit the tempo panel's live region too:
    // assert the VISIBLE summary line specifically.
    const summary = within(analysis)
      .getAllByText(new RegExp(i18n._('tempo.bpm', { 0: 120 })))
      .find((element) => element.closest('[hidden]') === null)
    expect(summary).toBeVisible()
  })

  it('reopens the zone from the stored preference', async () => {
    localStorage.setItem('loupe.analyser.open', 'false')
    const { user } = renderShell()
    await importTrack(user)

    // The stored manual choice wins over the fresh-import default.
    expect(
      screen.getByRole('button', {
        name: i18n._('shell.zone.analysis'),
        expanded: false
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })
})
