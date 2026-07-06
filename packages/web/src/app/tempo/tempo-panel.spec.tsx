// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { TempoPanel } from './tempo-panel.tsx'

function renderPanel(props: Partial<Parameters<typeof TempoPanel>[0]> = {}) {
  const onFold = vi.fn()
  render(
    <TempoPanel
      bpm={120}
      beatsPerBar={4}
      detecting={false}
      error={undefined}
      octaveShift={0}
      onFold={onFold}
      {...props}
    />,
    { wrapper: I18nTestingProvider }
  )
  return onFold
}

describe('TempoPanel', () => {
  it('folds up an octave when ×2 is pressed', async () => {
    const user = userEvent.setup()
    const onFold = renderPanel()
    await user.click(screen.getByRole('button', { name: i18n._('tempo.double') }))
    expect(onFold).toHaveBeenCalledWith(2)
  })

  it('halves the tempo when ÷2 is pressed', async () => {
    const user = userEvent.setup()
    const onFold = renderPanel()
    await user.click(screen.getByRole('button', { name: i18n._('tempo.halve') }))
    expect(onFold).toHaveBeenCalledWith(0.5)
  })

  it('disables ×2 once the tempo is folded up to its bound', () => {
    renderPanel({ octaveShift: 2 })
    expect(
      screen.getByRole('button', { name: i18n._('tempo.double') })
    ).toBeDisabled()
  })

  it('disables ÷2 once the tempo is folded down to its bound', () => {
    renderPanel({ octaveShift: -2 })
    expect(
      screen.getByRole('button', { name: i18n._('tempo.halve') })
    ).toBeDisabled()
  })

  it('shows the detected meter beside the BPM', () => {
    renderPanel({ beatsPerBar: 3 })
    expect(screen.getByText(i18n._('tempo.meter', { beatsPerBar: 3 }))).toBeInTheDocument()
  })

  it('shows no meter until a tempo is known', () => {
    renderPanel({ bpm: undefined, beatsPerBar: 4 })
    expect(
      screen.queryByText(i18n._('tempo.meter', { beatsPerBar: 4 }))
    ).not.toBeInTheDocument()
  })

  it('shows no octave controls until a tempo is known', () => {
    renderPanel({ bpm: undefined })
    expect(
      screen.queryByRole('button', { name: i18n._('tempo.double') })
    ).not.toBeInTheDocument()
  })
})
