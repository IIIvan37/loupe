// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  AudioFileDecoder,
  DecodedAudio,
  TrackMetadataReader,
  TrackSource
} from '@app/core'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import {
  audioFile,
  decoded,
  fakeProjectStores,
  fakeTrackSource,
  importTrack,
  installShellHooks,
  renderShell,
  saveProjectAs
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell imports', () => {
  it('ignores a superseded import that resolves after the newer one', async () => {
    const pending: Array<(audio: DecodedAudio) => void> = []
    const decoder: AudioFileDecoder = {
      decode: () =>
        new Promise((resolve) => {
          pending.push(resolve)
        })
    }
    const { user, container } = renderShell({ decoder })
    const input = screen.getByLabelText(i18n._('header.import-file'))
    await user.upload(input, audioFile('lent.wav'))
    await user.upload(input, audioFile('rapide.wav'))

    // The newer import resolves first (10 s)...
    await act(async () => {
      pending[1]?.(decoded)
    })
    // ...then the stale one lands with a different, shorter timeline.
    await act(async () => {
      pending[0]?.({ sampleRate: 1, channels: [[0, 0.5, 1]] })
    })

    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:10')).toBeInTheDocument()
  })

  it('surfaces a decode failure as an alert', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    const { user } = renderShell({ decoder })

    await user.upload(
      screen.getByLabelText(i18n._('header.import-file')),
      audioFile()
    )
    // The alert speaks plain words; the technical detail stays visible beside it.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        i18n._('waveform.import-error')
      )
    })
    expect(screen.getByText('unsupported format')).toBeInTheDocument()
  })

  it('shows the file tags in the header once read', async () => {
    const reader: TrackMetadataReader = {
      read: async () => ({ title: 'Nocturne', artist: 'Lena Vasquez' })
    }
    const { user } = renderShell({ metadataReader: reader })
    await importTrack(user)

    expect(await screen.findByText('Nocturne')).toBeInTheDocument()
    expect(screen.getByText('Lena Vasquez')).toBeInTheDocument()
  })

  it('falls back to the file name when the file has no tags', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // "take.wav" → "take" (extension stripped), no fake title applied.
    expect(screen.getByText('take')).toBeInTheDocument()
  })

  it('arms the import button for confirmation while the loaded track is not saved', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    expect(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    ).toBeInTheDocument()
  })

  it('keeps the file picker closed until the armed import is confirmed', async () => {
    const { user } = renderShell()
    await importTrack(user)
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    expect(picker).not.toHaveBeenCalled()
  })

  it('opens the file picker once the armed import is confirmed', async () => {
    const { user } = renderShell()
    await importTrack(user)
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    // The confirming click opens the import menu; « Fichier… » then picks.
    await user.click(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-file') })
    )

    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('opens the file picker from the menu when the session is saved', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    // A clean session opens the menu straight away — no confirmation step.
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-file') })
    )

    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('disarms the armed import when focus leaves the button', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    // Kept on fireEvent: only the blur itself is under test here.
    fireEvent.blur(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    )

    expect(
      screen.getByRole('button', { name: i18n._('header.import') })
    ).toBeInTheDocument()
  })

  /** Open the import menu and its « Depuis une URL… » popover, then fill the link. */
  async function fillImportUrl(user: UserEvent, url: string): Promise<void> {
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-url') })
    )
    // Paste (atomic) rather than type char-by-char: no intermediate host flickers
    // the unsupported warning, and no slow-typing timeout under parallel load.
    await user.click(screen.getByLabelText(i18n._('header.import-url-field')))
    await user.paste(url)
  }

  it('imports a track from a URL through the menu', async () => {
    const { user } = renderShell({
      trackSource: fakeTrackSource({ artist: 'Une chaîne' })
    })
    await fillImportUrl(user, 'https://youtu.be/abc')
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )

    // The track loads through the same decode path; its title and artist come
    // from the source metadata (the file carries no embedded tags here).
    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: i18n._('waveform.track-image') })
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Ma vidéo')).toBeInTheDocument()
    expect(await screen.findByText('Une chaîne')).toBeInTheDocument()
  })

  it('surfaces a URL download failure in an alert', async () => {
    const trackSource: TrackSource = {
      fetch: async () => {
        throw new Error('vidéo introuvable')
      }
    }
    const { user } = renderShell({ trackSource })
    await fillImportUrl(user, 'https://youtu.be/abc')
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )

    expect(await screen.findByText('vidéo introuvable')).toBeInTheDocument()
  })

  it('blocks an unsupported URL at the field, before any download', async () => {
    const fetchSpy = vi.fn()
    const { user } = renderShell({ trackSource: { fetch: fetchSpy } })
    await fillImportUrl(user, 'https://example.com/song')

    // The field validates against the same policy the use-case rejects on:
    // an inline warning, a disabled submit, and no request ever leaves.
    expect(
      screen.getByText(i18n._('header.import-url-unsupported'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    ).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  /** The shell's root element — where the drop handlers live. */
  function shellRoot(): HTMLElement {
    return screen.getByRole('banner').parentElement as HTMLElement
  }

  /** A file-carrying drag/drop init, as an OS file drag produces. */
  function fileTransfer(files: File[]) {
    return { dataTransfer: { files, types: ['Files'] } }
  }

  it('shows a drop overlay while a file is dragged over the app', () => {
    renderShell()
    const root = shellRoot()
    expect(screen.queryByText(i18n._('drop.overlay'))).not.toBeInTheDocument()

    fireEvent.dragEnter(root, fileTransfer([audioFile()]))
    expect(screen.getByText(i18n._('drop.overlay'))).toBeInTheDocument()

    fireEvent.dragLeave(root, fileTransfer([audioFile()]))
    expect(screen.queryByText(i18n._('drop.overlay'))).not.toBeInTheDocument()
  })

  it('imports a dropped audio file through the picker path', async () => {
    renderShell()
    const file = audioFile('glisse.wav')

    fireEvent.dragEnter(shellRoot(), fileTransfer([file]))
    fireEvent.drop(shellRoot(), fileTransfer([file]))

    // Same decode path as the picker → the waveform surface appears.
    expect(
      await screen.findByTestId('waveform-surface')
    ).toBeInTheDocument()
  })

  it('ignores a dropped non-audio file — no import', () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))

    // The empty-state hero is untouched — nothing was imported.
    expect(screen.getByText(i18n._('empty.headline'))).toBeInTheDocument()
  })

  it('warns when a drop holds no supported audio file', () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))

    expect(screen.getByRole('alert')).toHaveTextContent(
      i18n._('drop.unsupported')
    )
  })

  it('clears the unsupported-drop warning when a picker import starts', async () => {
    const { user } = renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))
    // A successful import through another path supersedes the warning.
    await importTrack(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the unsupported-drop warning once an audio drop lands', async () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))
    fireEvent.drop(shellRoot(), fileTransfer([audioFile('glisse.wav')]))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('confirms before a dropped file replaces unsaved work, then imports on confirm', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // A loaded-but-unsaved track: the drop must ask before replacing it.
    fireEvent.drop(shellRoot(), fileTransfer([audioFile('remplace.wav')]))
    expect(
      await screen.findByText(i18n._('drop.confirm-title'))
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: i18n._('drop.confirm-import') })
    )

    // The confirmation clears and the new track loads.
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('drop.confirm-title'))
      ).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('waveform-surface')).toBeInTheDocument()
  })

  it('keeps the current session when a drop confirmation is cancelled', async () => {
    const { user } = renderShell()
    await importTrack(user)

    fireEvent.drop(shellRoot(), fileTransfer([audioFile('remplace.wav')]))
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )

    // The prompt is gone and the original track is still loaded.
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('drop.confirm-title'))
      ).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('waveform-surface')).toBeInTheDocument()
  })
})
