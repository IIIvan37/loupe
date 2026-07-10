// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { LeadSheet } from './lead-sheet.tsx'

describe('LeadSheet', () => {
  it('renders a chord of the grid source', () => {
    render(<LeadSheet source={'[Verse]\n| C | Am | F | G |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('Am')).toBeInTheDocument()
  })

  it('shows a section label as a heading', () => {
    render(<LeadSheet source={'[Verse]\n| C |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('heading', { name: 'Verse' })
    ).toBeInTheDocument()
  })

  it('renders both chords that share a bar', () => {
    render(<LeadSheet source={'| F G |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
  })
})
