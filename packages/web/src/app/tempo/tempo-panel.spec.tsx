// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { createExternalValue } from '../../lib/external-value.ts'
import { TempoPanel } from './tempo-panel.tsx'

type PanelProps = Partial<Parameters<typeof TempoPanel>[0]>

function renderPanel(props: PanelProps = {}) {
  const onFold = vi.fn()
  const onOverrideBpm = vi.fn()
  const onTap = vi.fn()
  const onAlignPhase = vi.fn()
  const defaults: Parameters<typeof TempoPanel>[0] = {
    bpm: 120,
    beatsPerBar: 4,
    tempoMap: [{ fromSeconds: 0, bpm: 120 }],
    position: createExternalValue(0),
    detecting: false,
    error: undefined,
    octaveShift: 0,
    manual: false,
    onFold,
    onRetry: () => {},
    onOverrideBpm,
    onTap,
    onAlignPhase
  }
  const view = render(<TempoPanel {...defaults} {...props} />, {
    wrapper: I18nTestingProvider
  })
  const rerenderPanel = (next: PanelProps) =>
    view.rerender(<TempoPanel {...defaults} {...next} />)
  return { onFold, onOverrideBpm, onTap, onAlignPhase, rerenderPanel }
}

/** The editable BPM field, queried by its accessible name. */
function bpmField(): HTMLInputElement {
  return screen.getByRole('spinbutton', {
    name: i18n._('tempo.bpm-field')
  })
}

describe('TempoPanel', () => {
  it('folds up an octave when ×2 is pressed', async () => {
    const user = userEvent.setup()
    const { onFold } = renderPanel()
    await user.click(screen.getByRole('button', { name: i18n._('tempo.double') }))
    expect(onFold).toHaveBeenCalledWith(2)
  })

  it('halves the tempo when ÷2 is pressed', async () => {
    const user = userEvent.setup()
    const { onFold } = renderPanel()
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
      position: createExternalValue(15)
    })
    expect(bpmField()).toHaveValue(90)
  })

  it('shows the tempo range when the tempo varies', () => {
    renderPanel({
      tempoMap: [
        { fromSeconds: 0, bpm: 120 },
        { fromSeconds: 10, bpm: 90 }
      ],
      position: createExternalValue(0)
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
    const { rerenderPanel } = renderPanel({
      bpm: undefined,
      beatsPerBar: undefined,
      tempoMap: [],
      detecting: true
    })
    rerenderPanel({})
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.bpm', { 0: 120 })
    )
  })

  it('announces the analysis over a stale BPM when a detection re-runs', () => {
    // A failed run keeps the previous analysis, so a retry can start while a
    // BPM is still seated — the region must say the detection is running, not
    // stay silent on the stale figure.
    renderPanel({ bpm: 120, detecting: true })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.detecting')
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
      position: createExternalValue(15)
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('tempo.bpm', { 0: 120 })
    )
  })

  it('keeps the plain read-out when the tempo is steady', () => {
    renderPanel({
      bpm: 120,
      tempoMap: [{ fromSeconds: 0, bpm: 120 }],
      position: createExternalValue(30)
    })
    expect(
      screen.queryByText(i18n._('tempo.range', { min: 120, max: 120 }))
    ).not.toBeInTheDocument()
  })

  it('shows the tempo in an editable field', () => {
    renderPanel({ bpm: 120 })
    expect(bpmField()).toHaveValue(120)
  })

  it('commits a typed tempo on Enter', async () => {
    const user = userEvent.setup()
    const { onOverrideBpm } = renderPanel({ bpm: 120 })
    await user.clear(bpmField())
    await user.type(bpmField(), '96{Enter}')
    expect(onOverrideBpm).toHaveBeenCalledWith(96)
  })

  it('commits a typed tempo on blur', async () => {
    const user = userEvent.setup()
    const { onOverrideBpm } = renderPanel({ bpm: 120 })
    await user.clear(bpmField())
    await user.type(bpmField(), '84')
    await user.tab()
    expect(onOverrideBpm).toHaveBeenCalledWith(84)
  })

  it('commits an emptied field as NaN, never as zero', async () => {
    // Number('') is 0 — the hook must receive NaN so an emptied field stays
    // inert instead of clamping to the floor tempo.
    const user = userEvent.setup()
    const { onOverrideBpm } = renderPanel({ bpm: 120 })
    await user.clear(bpmField())
    await user.keyboard('{Enter}')
    expect(onOverrideBpm).toHaveBeenCalledWith(Number.NaN)
  })

  it('does not re-commit an untouched field on blur', async () => {
    const user = userEvent.setup()
    const { onOverrideBpm } = renderPanel({ bpm: 120 })
    await user.click(bpmField())
    await user.tab()
    expect(onOverrideBpm).not.toHaveBeenCalled()
  })

  it('offers the BPM field and tap even when detection found nothing', () => {
    // The manual path is the fallback when the detector fails or is offline.
    renderPanel({ bpm: undefined, tempoMap: [] })
    expect(bpmField()).toHaveValue(null)
    expect(
      screen.getByRole('button', { name: i18n._('tempo.tap') })
    ).toBeInTheDocument()
  })

  it('reports each tap', async () => {
    const user = userEvent.setup()
    const { onTap } = renderPanel()
    const tap = screen.getByRole('button', { name: i18n._('tempo.tap') })
    await user.click(tap)
    await user.click(tap)
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('aligns the grid phase on the playhead', async () => {
    const user = userEvent.setup()
    const { onAlignPhase } = renderPanel({ position: createExternalValue(12.5) })
    await user.click(
      screen.getByRole('button', { name: i18n._('tempo.align') })
    )
    expect(onAlignPhase).toHaveBeenCalledWith(12.5)
  })

  it('offers no phase alignment before a tempo exists', () => {
    renderPanel({ bpm: undefined, tempoMap: [] })
    expect(
      screen.queryByRole('button', { name: i18n._('tempo.align') })
    ).not.toBeInTheDocument()
  })

  it('flags a manual tempo as such', () => {
    renderPanel({ manual: true })
    expect(
      screen.getByText(i18n._('tempo.manual-badge'))
    ).toBeInTheDocument()
  })

  it('shows no manual flag on an untouched detection', () => {
    renderPanel({ manual: false })
    expect(
      screen.queryByText(i18n._('tempo.manual-badge'))
    ).not.toBeInTheDocument()
  })
})
