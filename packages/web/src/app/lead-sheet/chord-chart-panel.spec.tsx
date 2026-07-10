// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ChordChartPanel } from './chord-chart-panel.tsx'

/** The panel as the shell hosts it: controlled by lifted session state. */
function Host() {
  const [source, setSource] = useState('')
  return <ChordChartPanel source={source} onSourceChange={setSource} />
}

describe('ChordChartPanel', () => {
  it('renders the lead-sheet live from the typed grid', async () => {
    const user = userEvent.setup()
    render(<Host />, { wrapper: I18nTestingProvider })
    await user.type(screen.getByRole('textbox'), '| Am |')
    expect(screen.getByText('Am')).toBeInTheDocument()
  })
})
