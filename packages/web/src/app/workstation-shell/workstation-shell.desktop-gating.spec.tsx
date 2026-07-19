// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { screen } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import { installShellHooks, renderShell } from './shell-test-kit.tsx'

installShellHooks()

/**
 * Offload-only (Lot AJ): saved projects and URL import need the desktop shell
 * (local filesystem, yt-dlp). The browser is an analysis-only playground, so
 * those entry points hide entirely there — no broken or disabled affordances.
 */
describe('WorkstationShell desktop-only entry points', () => {
  it('hides Save / Projects / URL import in the browser', async () => {
    const { user } = renderShell({ desktop: false })

    expect(
      screen.queryByRole('button', { name: i18n._('header.projects') })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: i18n._('common.save') })
    ).toBeNull()

    // The Importer menu keeps « Fichier… » but drops « Depuis une URL… ».
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('header.import-from-file') })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('header.import-from-url') })
    ).toBeNull()
  })

  it('shows them in the desktop shell', async () => {
    const { user } = renderShell() // desktop: true by default in the kit

    expect(
      screen.getByRole('button', { name: i18n._('header.projects') })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('common.save') })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: i18n._('header.import') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('header.import-from-url') })
    ).toBeInTheDocument()
  })
})
