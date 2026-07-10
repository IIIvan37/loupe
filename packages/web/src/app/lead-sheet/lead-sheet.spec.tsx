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

  it('marks the measure being played as current', () => {
    render(
      <LeadSheet source={'| C | Am | F |'} currentMeasureIndex={1} />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText('Am').closest('[aria-current]')).not.toBeNull()
  })

  it('counts the played measure across sections (one global index)', () => {
    render(
      <LeadSheet
        source={'[A]\n| C | Am |\n[B]\n| F |'}
        currentMeasureIndex={2}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText('F').closest('[aria-current]')).not.toBeNull()
  })

  it('marks nothing while the playhead is before the first bar', () => {
    const { container } = render(<LeadSheet source={'| C | Am |'} />, {
      wrapper: I18nTestingProvider
    })
    expect(container.querySelector('[aria-current]')).toBeNull()
  })

  it('marks nothing when the grid is shorter than the played index', () => {
    const { container } = render(
      <LeadSheet source={'| C | Am |'} currentMeasureIndex={5} />,
      { wrapper: I18nTestingProvider }
    )
    expect(container.querySelector('[aria-current]')).toBeNull()
  })
})
