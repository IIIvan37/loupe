// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ShortcutsDialog } from './shortcuts-dialog.tsx'

const HINTS = [
  { keys: 'Espace', description: 'Lecture / Pause' },
  { keys: '→', description: 'Avancer de 5 s' }
] as const

describe('ShortcutsDialog', () => {
  it('lists each shortcut as a key/action pair when open', () => {
    render(
      <ShortcutsDialog open onOpenChange={() => {}} hints={HINTS} />
    )

    expect(screen.getByText('Espace')).toBeInTheDocument()
    expect(screen.getByText('Lecture / Pause')).toBeInTheDocument()
    expect(screen.getByText('Avancer de 5 s')).toBeInTheDocument()
  })

  it('asks to close when the close button is pressed', () => {
    const onOpenChange = vi.fn()
    render(
      <ShortcutsDialog open onOpenChange={onOpenChange} hints={HINTS} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
  })

  it('renders nothing while closed', () => {
    render(
      <ShortcutsDialog open={false} onOpenChange={() => {}} hints={HINTS} />
    )
    expect(screen.queryByText('Raccourcis clavier')).not.toBeInTheDocument()
  })
})
