// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { Project } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
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

describe('ProjectsDialog', () => {
  it('lists each project with its name and last-touch date when open', () => {
    render(
      <ProjectsDialog
        open
        onOpenChange={() => {}}
        projects={PROJECTS}
        onOpen={() => {}}
        onDelete={() => {}}
      />
    )

    expect(screen.getByText('Mon projet')).toBeInTheDocument()
    expect(screen.getByText('12/05/2026')).toBeInTheDocument()
  })

  it('shows the empty state when there is nothing saved', () => {
    render(
      <ProjectsDialog
        open
        onOpenChange={() => {}}
        projects={[]}
        onOpen={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByText('Aucun projet enregistré')).toBeInTheDocument()
  })

  it('asks to open or delete the picked project', () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(
      <ProjectsDialog
        open
        onOpenChange={() => {}}
        projects={PROJECTS}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(onOpen).toHaveBeenCalledWith('p1')
    fireEvent.click(
      screen.getByRole('button', { name: 'Supprimer Mon projet' })
    )
    expect(onDelete).toHaveBeenCalledWith('p1')
  })

  it('renders nothing while closed', () => {
    render(
      <ProjectsDialog
        open={false}
        onOpenChange={() => {}}
        projects={PROJECTS}
        onOpen={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.queryByText('Projets')).not.toBeInTheDocument()
  })
})
