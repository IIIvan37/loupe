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

/* The step labels are mirrored into a visually-hidden live region for screen
 * readers; text queries assert the VISIBLE read-out, so skip that channel. */
const visibleOnly = { ignore: 'script, style, [role="status"]' }

function renderPanel(
  partial: Partial<SeparationState>,
  props: Partial<Parameters<typeof SeparationPanel>[0]> = {}
) {
  const view = render(
    <SeparationPanel
      state={state(partial)}
      canSeparate
      serverHealth="ready"
      onSeparate={() => {}}
      onCancel={() => {}}
      {...props}
    />,
    { wrapper: I18nTestingProvider }
  )
  const rerenderPanel = (next: Partial<SeparationState>) =>
    view.rerender(
      <SeparationPanel
        state={state(next)}
        canSeparate
        serverHealth="ready"
        onSeparate={() => {}}
        onCancel={() => {}}
      />
    )
  return { ...view, rerenderPanel }
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

  it('disables the action and explains when the server is offline', () => {
    renderPanel({ status: 'idle' }, { serverHealth: 'offline' })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('separation.server-offline'))
    ).toBeInTheDocument()
  })

  it('disables the action and explains when the server has no separation engine', () => {
    renderPanel({ status: 'idle' }, { serverHealth: 'no-separation' })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('separation.server-no-separation'))
    ).toBeInTheDocument()
  })

  it('keeps the action available while the server is still being probed', () => {
    // 'checking' is transient on boot — disabling here would flash the button
    // off then on. Only the definitive offline/no-separation states block.
    renderPanel({ status: 'idle' }, { serverHealth: 'checking' })
    expect(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n._('separation.server-offline'))
    ).not.toBeInTheDocument()
  })

  it('shows the running phase and progress, swapping the action for a cancel', () => {
    renderPanel({ status: 'separating', progress: 0.4 })
    expect(
      screen.getByText(i18n._('separation.separating'), visibleOnly)
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })

  it('cancels the running separation on demand', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderPanel({ status: 'separating', progress: 0.4 }, { onCancel })
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('exposes a live status region before a run starts', () => {
    // A live region only announces content that CHANGES after it mounts, so
    // the region must already exist (empty) while the panel sits idle.
    renderPanel({ status: 'idle' })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces the running phase to screen readers', () => {
    const { rerenderPanel } = renderPanel({ status: 'idle' })
    rerenderPanel({ status: 'separating', progress: 0.4 })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('separation.separating')
    )
  })

  it('announces the completion of the run', () => {
    // The most important announcement of all: the visible panel steps aside
    // once the stems are ready, but the live region must survive to say so.
    const { rerenderPanel } = renderPanel({ status: 'separating', progress: 0.9 })
    rerenderPanel({ status: 'ready', progress: 1, stems })
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n._('separation.done')
    )
  })

  it('keeps the moving percentage out of the live region', () => {
    // Steps are announced, the percentage is not — a polite region re-reading
    // every progress tick would drown the screen reader in numbers.
    renderPanel({ status: 'separating', progress: 0.4 })
    expect(screen.getByRole('status')).not.toHaveTextContent('40')
  })

  it('steps aside entirely once the stems are ready', () => {
    // The stems become the mixer (lanes + gutter headers) and the « Non
    // détectés » caption moves to the gutter, so this affordance has nothing
    // left to show — masked stems present or not. Only the invisible live
    // region stays behind, to announce the completion.
    renderPanel({ status: 'ready', progress: 1, stems })
    expect(
      screen.queryByRole('region', {
        name: i18n._('separation.region-label')
      })
    ).not.toBeInTheDocument()
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
