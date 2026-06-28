// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { WorkstationShell } from './workstation-shell.tsx'

describe('WorkstationShell', () => {
  it('renders the core workstation landmarks', () => {
    render(<WorkstationShell />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('shows the product wordmark', () => {
    render(<WorkstationShell />)

    expect(screen.getByText('Loupe')).toBeInTheDocument()
  })

  it('exposes the analysis tabs', () => {
    render(<WorkstationShell />)

    expect(screen.getByRole('tab', { name: 'Spectre' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Repères' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument()
  })
})
