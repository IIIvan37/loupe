// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  failingSeparator,
  fakeSeparator,
  importTrack,
  installShellHooks,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell stems & separation', () => {
  /** jsdom implements neither; downloadBlob needs both. */
  function stubDownload(): void {
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  }

  it('confirms a synthetic-lane WAV download (Piste, Métronome) with a toast', async () => {
    stubDownload()
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // The un-separated track exposes its own « Piste » lane plus the click.
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Piste' })
      })
    )
    expect(
      await screen.findByText(i18n._('toast.file-exported'))
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    )
    expect(
      await screen.findAllByText(i18n._('toast.file-exported'))
    ).not.toHaveLength(0)
  })

  it('confirms a separated-stem WAV download with a toast', async () => {
    stubDownload()
    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )

    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Voix' })
      })
    )
    expect(
      await screen.findByText(i18n._('toast.file-exported'))
    ).toBeInTheDocument()
  })

  it('separates the loaded track on demand and lists the stems', async () => {
    const { user } = renderShell({ separator: fakeSeparator() })

    // The action does not exist until a track is loaded (empty-state stands in).
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()

    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))

    // The stems land in the mixer: one fader (and lane) per separated stem.
    expect(
      await screen.findByRole('slider', { name: i18n._('mixer.volume', { name: 'Voix' }) })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: i18n._('mixer.volume', { name: 'Basse' }) })
    ).toBeInTheDocument()
    // The action is gone once the stems are ready.
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })

  it('surfaces a separation failure and offers a retry', async () => {
    const { user } = renderShell({ separator: failingSeparator })
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))

    // Typed copy (M1.4): the network code speaks in the user's words — the
    // raw adapter detail (« service injoignable ») stays in the console.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(i18n._('analysis.error.network-offload'))
    expect(
      screen.getByRole('button', { name: i18n._('separation.retry') })
    ).toBeInTheDocument()
  })

  it('enables the header export only once stems are ready', async () => {
    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)

    const exportButton = screen.getByRole('button', { name: i18n._('header.export') })
    expect(exportButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))
    await waitFor(() => expect(exportButton).toBeEnabled())
  })

  it('confirms a successful stem export with a toast', async () => {
    // jsdom implements neither; downloadBlob needs both.
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    const exportButton = screen.getByRole('button', {
      name: i18n._('header.export')
    })
    await waitFor(() => expect(exportButton).toBeEnabled())

    await user.click(exportButton)
    expect(
      await screen.findByText(i18n._('toast.stems-exported'))
    ).toBeInTheDocument()
  })

  it('narrates the export in the header while the zip is built', async () => {
    // The busy line is painted BEFORE the synchronous zip freezes the thread
    // (R.4): it must be up as soon as the click handler yields.
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    const exportButton = screen.getByRole('button', {
      name: i18n._('header.export')
    })
    await waitFor(() => expect(exportButton).toBeEnabled())

    fireEvent.click(exportButton)
    // Synchronously after the click: the busy face is already up.
    expect(screen.getByText(i18n._('header.exporting'))).toBeInTheDocument()
    await screen.findByText(i18n._('toast.stems-exported'))
    expect(
      screen.queryByText(i18n._('header.exporting'))
    ).not.toBeInTheDocument()
  })
})
