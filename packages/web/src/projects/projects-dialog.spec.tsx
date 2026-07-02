// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { Project } from '@app/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ProjectsDialog } from './projects-dialog.tsx'

// Midday UTC, so the local date is 12/05/2026 in any nearby timezone.
const UPDATED_AT = Date.parse('2026-05-12T12:00:00Z')

const PROJECTS: readonly Project[] = [
  {
    id: 'p1',
    name: 'Mon projet',
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    source: { title: 'Song', artist: 'Band', audioRef: 'abc' },
    loops: [],
    markers: []
  }
]

type DialogProps = Partial<Parameters<typeof ProjectsDialog>[0]>

function renderDialog(overrides: DialogProps = {}) {
  return render(
    <ProjectsDialog
      open
      onOpenChange={() => {}}
      projects={PROJECTS}
      onOpen={() => {}}
      onDelete={() => {}}
      {...overrides}
    />
  )
}

/**
 * Render, then let Base UI's initial focus land — it is deferred to an
 * animation frame, and in jsdom that frame can fire MID-TEST, stealing focus
 * from an armed « Confirmer ? » and disarming it under the second click. Any
 * test that clicks must settle it first (a real browser settles within one
 * frame of opening, long before a human can click). The condition asserts the
 * focus is INSIDE the popup: "not on body" would pass early wherever a click
 * opened the dialog, with focus still on the trigger.
 */
async function renderDialogSettled(overrides: DialogProps = {}) {
  const utils = renderDialog(overrides)
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement | null
    )
  })
  return utils
}

describe('ProjectsDialog', () => {
  it('lists each project with its name and last-touch date when open', () => {
    renderDialog()

    expect(screen.getByText('Mon projet')).toBeInTheDocument()
    expect(screen.getByText('12/05/2026')).toBeInTheDocument()
  })

  it('shows the empty state when there is nothing saved', () => {
    renderDialog({ projects: [] })
    expect(screen.getByText('Aucun projet enregistré')).toBeInTheDocument()
  })

  it('shows the unreachable-server message instead of the empty state', () => {
    renderDialog({
      projects: [],
      errorMessage:
        'Serveur injoignable — vérifie que le serveur local est lancé'
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Serveur injoignable')
    expect(
      screen.queryByText('Aucun projet enregistré')
    ).not.toBeInTheDocument()
  })

  it('opens the picked project with a single click when nothing would be lost', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    await renderDialogSettled({ onOpen })

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('asks before opening when the current session would be replaced', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    await renderDialogSettled({ onOpen, confirmBeforeOpen: true })

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(onOpen).not.toHaveBeenCalled()
    expect(
      screen.getByText('La session actuelle sera remplacée')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Mon projet" })
    )
    expect(onOpen).toHaveBeenCalledWith('p1')
  })

  it('deletes only after the inline two-step confirmation', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    await renderDialogSettled({ onDelete })

    await user.click(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    )
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmer la suppression de Mon projet'
      })
    )
    expect(onDelete).toHaveBeenCalledWith('p1')
  })

  it('reverts an armed confirmation after 4 s of hesitation', () => {
    vi.useFakeTimers()
    const onDelete = vi.fn()
    renderDialog({ onDelete })

    // user-event limitation: user.click hangs under vi.useFakeTimers (its
    // internal waits never resolve on the fake clock), so fireEvent stays here.
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Mon projet' }))
    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(
      screen.queryByRole('button', {
        name: 'Confirmer la suppression de Mon projet'
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    ).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('reverts an armed confirmation when it loses focus', async () => {
    const user = userEvent.setup()
    await renderDialogSettled()

    await user.click(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    )
    fireEvent.blur(
      screen.getByRole('button', {
        name: 'Confirmer la suppression de Mon projet'
      })
    )

    expect(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    ).toBeInTheDocument()
  })

  it('marks the opening row and locks every action while it loads', () => {
    renderDialog({ openingId: 'p1' })

    const opening = screen.getByRole('button', { name: 'Ouverture…' })
    expect(opening).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    ).toBeDisabled()
  })

  it('renders nothing while closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Projets')).not.toBeInTheDocument()
  })
})
