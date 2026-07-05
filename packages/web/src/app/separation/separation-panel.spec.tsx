// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { SeparationState, StemSet } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { SeparationPanel } from './separation-panel.tsx'

const emptyTrack = { sampleRate: 4, durationSeconds: 1, waveform: { peaks: [] } }
const stems: StemSet = [
  { id: 'voix', label: 'Voix', track: emptyTrack, confidence: 1, present: true },
  {
    id: 'basse',
    label: 'Basse',
    track: emptyTrack,
    confidence: 0.6,
    present: true
  },
  {
    id: 'guitare',
    label: 'Guitare',
    track: emptyTrack,
    confidence: 0.02,
    present: false
  }
]

function state(partial: Partial<SeparationState>): SeparationState {
  return { status: 'idle', progress: 0, stems: [], error: undefined, ...partial }
}

function renderPanel(
  partial: Partial<SeparationState>,
  props: Partial<Parameters<typeof SeparationPanel>[0]> = {}
) {
  return render(
    <SeparationPanel
      state={state(partial)}
      canSeparate
      onSeparate={() => {}}
      {...props}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('SeparationPanel', () => {
  it('separates the loaded track on demand', async () => {
    const user = userEvent.setup()
    const onSeparate = vi.fn()
    renderPanel({ status: 'idle' }, { onSeparate })
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    expect(onSeparate).toHaveBeenCalledOnce()
  })

  it('disables the action until a track is loaded', () => {
    renderPanel({ status: 'idle' }, { canSeparate: false })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
  })

  it('shows the running phase and progress, hiding the action', () => {
    renderPanel({ status: 'separating', progress: 0.4 })
    expect(
      screen.getByText(i18n._('separation.separating'))
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('steps aside entirely once the stems are ready', () => {
    // The stems become the mixer (lanes + gutter headers) and the « Non
    // détectés » caption moves to the gutter, so this affordance has nothing
    // left to show — masked stems present or not.
    const { container } = renderPanel({ status: 'ready', progress: 1, stems })
    expect(container).toBeEmptyDOMElement()
  })

  it('surfaces a failure and offers a retry', async () => {
    const user = userEvent.setup()
    const onSeparate = vi.fn()
    renderPanel({ status: 'error', error: 'moteur indisponible' }, { onSeparate })
    expect(screen.getByRole('alert')).toHaveTextContent(
      i18n._('separation.failed', { error: 'moteur indisponible' })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.retry') })
    )
    expect(onSeparate).toHaveBeenCalledOnce()
  })
})
