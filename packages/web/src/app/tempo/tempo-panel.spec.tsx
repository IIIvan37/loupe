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
      tempoMap={[{ fromSeconds: 0, bpm: 120 }]}
      positionSeconds={0}
      detecting={false}
      error={undefined}
      octaveShift={0}
      onFold={onFold}
      onRetry={() => {}}
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

  it('reads the tempo at the playhead when the tempo varies', () => {
    // Two segments: 120 from 0 s, 90 from 10 s — the playhead sits in the second.
    renderPanel({
      tempoMap: [
        { fromSeconds: 0, bpm: 120 },
        { fromSeconds: 10, bpm: 90 }
      ],
      positionSeconds: 15
    })
    expect(screen.getByText(i18n._('tempo.bpm', { 0: 90 }))).toBeInTheDocument()
  })

  it('shows the tempo range when the tempo varies', () => {
    renderPanel({
      tempoMap: [
        { fromSeconds: 0, bpm: 120 },
        { fromSeconds: 10, bpm: 90 }
      ],
      positionSeconds: 0
    })
    expect(
      screen.getByText(i18n._('tempo.range', { min: 90, max: 120 }))
    ).toBeInTheDocument()
  })

  it('offers to retry when the detection failed', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderPanel({ bpm: undefined, error: 'server unreachable', onRetry })
    await user.click(
      screen.getByRole('button', { name: i18n._('tempo.retry') })
    )
    expect(onRetry).toHaveBeenCalled()
  })

  it('offers no retry while the detection has not failed', () => {
    renderPanel({ error: undefined })
    expect(
      screen.queryByRole('button', { name: i18n._('tempo.retry') })
    ).not.toBeInTheDocument()
  })

  it('announces the analysis to screen readers', () => {
    renderPanel({ bpm: undefined, beatsPerBar: undefined, detecting: true })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.detecting')
    )
  })

  it('announces the detected BPM once it lands', () => {
    const { rerender } = render(
      <TempoPanel
        bpm={undefined}
        beatsPerBar={undefined}
        tempoMap={[]}
        positionSeconds={0}
        detecting={true}
        error={undefined}
        octaveShift={0}
        onFold={() => {}}
        onRetry={() => {}}
      />,
      { wrapper: I18nTestingProvider }
    )
    rerender(
      <TempoPanel
        bpm={120}
        beatsPerBar={4}
        tempoMap={[{ fromSeconds: 0, bpm: 120 }]}
        positionSeconds={0}
        detecting={false}
        error={undefined}
        octaveShift={0}
        onFold={() => {}}
        onRetry={() => {}}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.bpm', { 0: 120 })
    )
  })

  it('keeps the playhead-following read-out out of the live region', () => {
    // On a varying track the visible read-out follows the playhead; the live
    // region announces the representative BPM only, or every segment change
    // during playback would be spoken.
    renderPanel({
      bpm: 120,
      tempoMap: [
        { fromSeconds: 0, bpm: 120 },
        { fromSeconds: 10, bpm: 90 }
      ],
      positionSeconds: 15
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.bpm', { 0: 120 })
    )
  })

  it('keeps the plain read-out when the tempo is steady', () => {
    renderPanel({
      bpm: 120,
      tempoMap: [{ fromSeconds: 0, bpm: 120 }],
      positionSeconds: 30
    })
    expect(
      screen.queryByText(i18n._('tempo.range', { min: 120, max: 120 }))
    ).not.toBeInTheDocument()
  })
})
