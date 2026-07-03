// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { MarkerList } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { AnalysisPanel } from './analysis-panel.tsx'

const markers: MarkerList = [
  { id: 'a', timeSeconds: 5, label: 'Repère 1' }
]

const noop = () => {}

describe('AnalysisPanel', () => {
  it('lists markers of every kind and seeks one', async () => {
    const user = userEvent.setup()
    const onSeekMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={onSeekMarker}
        onRenameMarker={noop}
        onRemoveMarker={noop}
      />,
      { wrapper: I18nTestingProvider }
    )
    // A beat marker has no rail tag, so the inspector is its only seek path.
    // The seek row carries the timecode; the remove button does not.
    await user.click(screen.getByRole('button', { name: /0:05/ }))
    expect(onSeekMarker).toHaveBeenCalledWith(5)
  })

  it('renames a marker through the editor', async () => {
    const user = userEvent.setup()
    const onRenameMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={noop}
        onRenameMarker={onRenameMarker}
        onRemoveMarker={noop}
      />,
      { wrapper: I18nTestingProvider }
    )
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

  it('removes a marker', async () => {
    const user = userEvent.setup()
    const onRemoveMarker = vi.fn()
    render(
      <AnalysisPanel
        markers={markers}
        onSeekMarker={noop}
        onRenameMarker={noop}
        onRemoveMarker={onRemoveMarker}
      />,
      { wrapper: I18nTestingProvider }
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('markers.remove-named', { name: 'Repère 1' })
      })
    )
    expect(onRemoveMarker).toHaveBeenCalledWith('a')
  })

  it('invites adding markers when there are none', () => {
    render(
      <AnalysisPanel
        markers={[]}
        onSeekMarker={noop}
        onRenameMarker={noop}
        onRemoveMarker={noop}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText(i18n._('analysis.no-markers'))).toBeInTheDocument()
  })
})
