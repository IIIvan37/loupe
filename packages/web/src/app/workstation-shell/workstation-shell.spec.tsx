// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { screen } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell', () => {
  it('renders the core workstation landmarks', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('exposes the analysis tabs once a track is loaded', async () => {
    const { user } = renderShell()
    await importTrack(user)
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-spectrum') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-markers') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })).toBeInTheDocument()
  })

  it('shows the empty-state drop hero before any track is loaded', () => {
    renderShell()
    // The workstation is replaced by a first-run hero prompting a drop/import,
    // not a greyed-out shell — the analysis workspace only appears once loaded.
    expect(screen.getByText(i18n._('empty.headline'))).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: i18n._('analysis.tab-markers') })
    ).not.toBeInTheDocument()
  })
})
