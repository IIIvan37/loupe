// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  ProjectDeps
} from '@app/core'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  brokenProjectStores,
  fakeProjectStores,
  importTrack,
  installShellHooks,
  openLoops,
  openProjectsDialog,
  pointerGesture,
  renderShell,
  saveNamedLoop,
  saveProjectAs,
  savedLoop
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell projects & persistence', () => {
  it('surfaces a failed save as a dismissible alert banner', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: i18n._('header.save-project') })
    )
    await user.clear(screen.getByLabelText(i18n._('common.name')))
    await user.type(screen.getByLabelText(i18n._('common.name')), 'Mon projet')
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Impossible d'enregistrer le projet : server down"
    )

    await user.click(screen.getByRole('button', { name: i18n._('alerts.close') }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-saves an existing project in one click, keeping a rename popover', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    // One direct click — no popover asks for the name again.
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
    expect(screen.queryByLabelText('Nom')).not.toBeInTheDocument()

    // Still a single project, under the same name.
    await openProjectsDialog(user)
    expect(await screen.findByText('Mon projet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: i18n._('projects.open') })).toHaveLength(1)
  })

  it('detaches the session from the saved project when a new file is imported', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    // A new import starts a fresh session — the header must offer a first
    // save (name popover), not a one-click re-save onto the old project.
    await importTrack(user)

    expect(
      screen.getByRole('button', { name: i18n._('header.save-project') })
    ).toBeInTheDocument()
  })

  it('saves the re-imported session as a second project, not over the first', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    await importTrack(user)
    await saveProjectAs(user, 'Deuxième morceau')

    await openProjectsDialog(user)
    expect(
      await screen.findAllByRole('button', { name: i18n._('projects.open') })
    ).toHaveLength(2)
  })

  it('asks before opening a project over unsaved session changes', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    // Drift from the saved project — the session now holds unsaved work.
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    // The session would be replaced — the row asks for a confirmation first.
    expect(
      screen.getByText(i18n._('session.replaced'))
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('projects.confirm-open', { name: 'Mon projet' })
      })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: i18n._('projects.open') })
      ).not.toBeInTheDocument()
    })
  })

  it('restores the armed A/B region — the loupe — when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    // An A/B drag alone (never saved as a named loop) IS the loupe being used.
    pointerGesture(20, 60)
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region must come back armed, exactly as the user left it.
    expect(
      await screen.findByRole('button', { name: i18n._('loops.active') })
    ).toBeInTheDocument()
  })

  it('restores the loupe with looping still disabled when it was off at save', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    pointerGesture(20, 60)
    // Turn the wrap-around off before saving: play-through mode.
    await user.click(screen.getByRole('button', { name: i18n._('loops.active') }))
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region is back but still in play-through mode, as it was saved.
    expect(
      await screen.findByRole('button', { name: i18n._('loops.inactive') })
    ).toBeInTheDocument()
  })

  it('relinks the restored region to its saved loop (no duplicate save offered)', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region is armed AND recognised as the saved « Refrain »: offering
    // « Enregistrer la boucle » again would invite a duplicate.
    await screen.findByRole('button', { name: i18n._('loops.active') })
    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()
  })

  it('restores the saved loops when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    // Move on to a fresh track — its session starts without the loop.
    await importTrack(user, 'autre.wav')
    await openLoops(user)
    expect(
      screen.queryByRole('button', { name: savedLoop('Refrain') })
    ).not.toBeInTheDocument()

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The reopened project must bring its saved loop back.
    expect(
      await screen.findByRole('button', { name: savedLoop('Refrain') })
    ).toBeInTheDocument()
  })

  it('discards a resolving open once a new file was imported meanwhile', async () => {
    const working = fakeProjectStores()
    let gateNext = false
    let release: (() => void) | undefined
    const gated: ProjectDeps = {
      store: {
        ...working.store,
        load: (id) => {
          if (!gateNext) {
            return working.store.load(id)
          }
          return new Promise((resolve) => {
            release = () => resolve(working.store.load(id))
          })
        }
      },
      audio: working.audio
    }
    const { user } = renderShell({ projectStores: gated })
    await importTrack(user)
    await saveProjectAs(user, 'Projet A')

    gateNext = true
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    // The open hangs on the gated store; leave the dialog, import a new file.
    await user.click(screen.getByRole('button', { name: i18n._('common.close') }))
    await importTrack(user, 'nouveau.wav')

    await act(async () => {
      release?.()
    })

    // The stale open must not clobber the freshly imported session.
    expect(screen.getByText('nouveau')).toBeInTheDocument()
  })

  it('shows « Enregistré », flips to « Non enregistré » on a change, back on re-save', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()

    // Any persisted-state change drifts the session from its saved project.
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    expect(await screen.findByText(i18n._('header.unsaved'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()
  })

  it('confirms a successful save with a toast', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    expect(
      await screen.findByText(
        i18n._('toast.project-saved', { name: 'Mon projet' })
      )
    ).toBeInTheDocument()
  })

  it('flips to « Non enregistré » when the tempo changes', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '85' }
    })

    expect(await screen.findByText(i18n._('header.unsaved'))).toBeInTheDocument()
  })

  it('restores the saved tempo and zoom when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '85' }
    })
    fireEvent.change(screen.getByLabelText(i18n._('waveform.zoom-slider')), {
      target: { value: '3' }
    })
    await saveProjectAs(user, 'Mon projet')

    // Move on to a fresh track and drift the tuning away from the saved one.
    await importTrack(user, 'autre.wav')
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '110' }
    })

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The reopened project practises at its saved tempo and magnification.
    const tempo = screen.getByLabelText(
      i18n._('transport.tempo-slider')
    ) as HTMLInputElement
    await waitFor(() => expect(tempo.value).toBe('85'))
    expect(
      (screen.getByLabelText(i18n._('waveform.zoom-slider')) as HTMLInputElement).value
    ).toBe('3')
  })

  /** Fire a cancelable beforeunload and report whether the guard blocked it. */
  function unloadPrevented(): boolean {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('blocks the page unload while the loaded track is not saved', async () => {
    const { user } = renderShell()
    await importTrack(user)

    expect(unloadPrevented()).toBe(true)
  })

  it('lets the page unload once the session is saved', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))

    expect(unloadPrevented()).toBe(false)
  })

  it('opens a saved project directly when the session holds no unsaved work', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    // No « Confirmer ? » step: the open starts at once and closes the dialog.
    // (Scope to the projects dialog by name — a success toast is itself a
    // non-modal `role="dialog"` and would otherwise match a bare query.)
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: i18n._('projects.title') })
      ).not.toBeInTheDocument()
    })
  })

  it('announces the rebuild while a project opens', async () => {
    const working = fakeProjectStores()
    let release: (() => void) | undefined
    let gateNext = false
    const gated: ProjectDeps = {
      store: working.store,
      audio: {
        ...working.audio,
        get: (ref) => {
          if (!gateNext) {
            return working.audio.get(ref)
          }
          return new Promise((resolve) => {
            release = () => resolve(working.audio.get(ref))
          })
        }
      }
    }
    const { user } = renderShell({ projectStores: gated })
    await importTrack(user)
    await saveProjectAs(user, 'Projet lent')

    gateNext = true
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    expect(
      await screen.findByText(i18n._('header.opening', { name: 'Projet lent' }))
    ).toBeInTheDocument()

    await act(async () => {
      release?.()
    })
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('header.opening', { name: 'Projet lent' }))
      ).not.toBeInTheDocument()
    })
  })

  it('highlights the chip of the saved loop the region came from', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')

    await openLoops(user)
    expect(
      await screen.findByRole('button', { name: savedLoop('Refrain') })
    ).toHaveAttribute('aria-current', 'true')
  })

  it('says the server is unreachable when the projects listing fails', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })

    await openProjectsDialog(user)

    expect(
      await screen.findByText(
        i18n._('projects.unreachable')
      )
    ).toBeInTheDocument()
  })

  // ── Native OS-file drop ──────────────────────────────────────────────────
  // The shell is the full-surface drop target; a dropped audio file rides the
  // exact import path the picker uses, guarded by the same unsaved-work confirm.
})
