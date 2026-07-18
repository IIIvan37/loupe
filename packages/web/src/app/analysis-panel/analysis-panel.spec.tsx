// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopLibrary, MarkerList } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { createExternalValue } from '../../lib/external-value.ts'
import { AnalysisPanel } from './analysis-panel.tsx'

const markers: MarkerList = [{ id: 'a', timeSeconds: 5, label: 'Repère 1' }]
const loops: LoopLibrary = [
  { id: 'l', name: 'Refrain', region: { startSeconds: 48, endSeconds: 92 } }
]
const noop = () => {}

function renderPanel(
  overrides: Partial<Parameters<typeof AnalysisPanel>[0]> = {}
) {
  return render(
    <AnalysisPanel
      readSpectrum={() => undefined}
      playing={false}
      position={createExternalValue(0)}
      markers={markers}
      onSeekMarker={noop}
      onRenameMarker={noop}
      onRemoveMarker={noop}
      onLoopSection={noop}
      loops={loops}
      activeLoopId={null}
      onActivateLoop={noop}
      onUpdateLoop={noop}
      onRemoveLoop={noop}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('AnalysisPanel', () => {
  it('shows the chroma read-out under the Spectre tab', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-spectrum') })
    )
    expect(
      screen.getByText(i18n._('analysis.chroma-idle'))
    ).toBeInTheDocument()
  })

  it('lists markers of every kind and seeks one', async () => {
    const user = userEvent.setup()
    const onSeekMarker = vi.fn()
    renderPanel({ onSeekMarker })
    // The seek row carries the timecode; the remove button does not.
    await user.click(screen.getByRole('button', { name: /0:05/ }))
    expect(onSeekMarker).toHaveBeenCalledWith(5)
  })

  it('offers « Boucler » on a structure marker row', async () => {
    const user = userEvent.setup()
    const onLoopSection = vi.fn()
    const section = {
      id: 's',
      timeSeconds: 10,
      label: 'Couplet',
      kind: 'structure' as const
    }
    renderPanel({ markers: [section], onLoopSection })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.loop-named', { name: 'Couplet' })
      })
    )
    expect(onLoopSection).toHaveBeenCalledWith(section)
  })

  it('offers no « Boucler » on a plain cue (a point, not a span)', () => {
    renderPanel()
    expect(
      screen.queryByRole('button', {
        name: i18n._('markers.loop-named', { name: 'Repère 1' })
      })
    ).not.toBeInTheDocument()
  })

  it('renames a marker through the editor', async () => {
    const user = userEvent.setup()
    const onRenameMarker = vi.fn()
    renderPanel({ onRenameMarker })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.rename-named', { name: 'Repère 1' })
      })
    )
    const input = screen.getByLabelText(i18n._('common.name'))
    await user.clear(input)
    await user.type(input, 'Intro')
    await user.click(
      screen.getByRole('button', { name: i18n._('common.rename') })
    )
    expect(onRenameMarker).toHaveBeenCalledWith('a', 'Intro')
  })

  it('arms the marker removal instead of removing on the first click', async () => {
    const user = userEvent.setup()
    const onRemoveMarker = vi.fn()
    renderPanel({ onRemoveMarker })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.remove-named', { name: 'Repère 1' })
      })
    )
    expect(onRemoveMarker).not.toHaveBeenCalled()
  })

  it('removes a marker on the confirming second click', async () => {
    const user = userEvent.setup()
    const onRemoveMarker = vi.fn()
    renderPanel({ onRemoveMarker })
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.remove-named', { name: 'Repère 1' })
      })
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.confirm-remove', { name: 'Repère 1' })
      })
    )
    expect(onRemoveMarker).toHaveBeenCalledWith('a')
  })

  it('disarms the marker removal when the armed button loses focus', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.remove-named', { name: 'Repère 1' })
      })
    )
    await user.tab()
    expect(
      screen.getByRole('button', {
        name: i18n._('markers.remove-named', { name: 'Repère 1' })
      })
    ).toBeInTheDocument()
  })

  it('invites adding markers when there are none', () => {
    renderPanel({ markers: [] })
    expect(screen.getByText(i18n._('analysis.no-markers'))).toBeInTheDocument()
  })

  it('recalls a saved loop from the loops tab', async () => {
    const user = userEvent.setup()
    const onActivateLoop = vi.fn()
    renderPanel({ onActivateLoop })
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
    )
    // The row's start–end range labels the recall button.
    await user.click(screen.getByRole('button', { name: /0:48–1:32/ }))
    expect(onActivateLoop).toHaveBeenCalledWith(loops[0])
  })

  it('marks the active loop and renames it in place', async () => {
    const user = userEvent.setup()
    const onUpdateLoop = vi.fn()
    renderPanel({ activeLoopId: 'l', onUpdateLoop })
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
    )
    expect(screen.getByRole('button', { name: /0:48–1:32/ })).toHaveAttribute(
      'aria-current',
      'true'
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('loops.rename-named', { name: 'Refrain' })
      })
    )
    const input = screen.getByLabelText(i18n._('common.name'))
    await user.clear(input)
    await user.type(input, 'Couplet')
    await user.click(
      screen.getByRole('button', { name: i18n._('common.rename') })
    )
    expect(onUpdateLoop).toHaveBeenCalledWith({
      id: 'l',
      name: 'Couplet',
      region: { startSeconds: 48, endSeconds: 92 }
    })
  })

  it('arms the loop removal instead of removing on the first click', async () => {
    const user = userEvent.setup()
    const onRemoveLoop = vi.fn()
    renderPanel({ onRemoveLoop })
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('loops.remove-named', { name: 'Refrain' })
      })
    )
    expect(onRemoveLoop).not.toHaveBeenCalled()
  })

  it('removes a saved loop on the confirming second click', async () => {
    const user = userEvent.setup()
    const onRemoveLoop = vi.fn()
    renderPanel({ onRemoveLoop })
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('loops.remove-named', { name: 'Refrain' })
      })
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('loops.confirm-remove', { name: 'Refrain' })
      })
    )
    expect(onRemoveLoop).toHaveBeenCalledWith('l')
  })

  it('invites saving a loop when there are none', async () => {
    const user = userEvent.setup()
    renderPanel({ loops: [] })
    await user.click(
      screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
    )
    expect(screen.getByText(i18n._('analysis.no-loops'))).toBeInTheDocument()
  })
})
