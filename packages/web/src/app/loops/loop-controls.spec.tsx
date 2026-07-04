// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopRegion } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { LoopControls } from './loop-controls.tsx'

const region: LoopRegion = { startSeconds: 2, endSeconds: 6 }
const noop = () => {}

function renderControls(
  overrides: Partial<Parameters<typeof LoopControls>[0]> = {}
) {
  return render(
    <LoopControls
      region={region}
      isSaved={false}
      loopEnabled
      onToggleLoop={noop}
      onSaveRegion={noop}
      onClearRegion={noop}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
}

describe('LoopControls', () => {
  it('renders nothing until a region is selected', () => {
    const { container } = renderControls({ region: undefined })
    expect(container).toBeEmptyDOMElement()
  })

  it('offers save and clear for a fresh (unsaved) region', () => {
    renderControls({ isSaved: false })
    expect(
      screen.getByRole('button', { name: i18n._('loops.save-region') })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('loops.clear-region') })
    ).toBeInTheDocument()
  })

  it('drops save and clear when the active region is already saved', () => {
    // A saved loop is active → no duplicate save, and no clear: the loop is
    // removed from its sidebar row instead. Only the toggle stays.
    renderControls({ isSaved: true })
    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('loops.clear-region') })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('loops.active') })
    ).toBeInTheDocument()
  })

  it('toggles looping on and off for the active region', async () => {
    const user = userEvent.setup()
    const onToggleLoop = vi.fn()
    const { rerender } = renderControls({ loopEnabled: true, onToggleLoop })

    const toggle = screen.getByRole('button', { name: i18n._('loops.active') })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(onToggleLoop).toHaveBeenCalledOnce()

    rerender(
      <LoopControls
        region={region}
        isSaved={false}
        loopEnabled={false}
        onToggleLoop={onToggleLoop}
        onSaveRegion={noop}
        onClearRegion={noop}
      />
    )
    expect(
      screen.getByRole('button', { name: i18n._('loops.inactive') })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('names and saves the active region through the editor', async () => {
    const user = userEvent.setup()
    const onSaveRegion = vi.fn()
    renderControls({ onSaveRegion })

    await user.click(
      screen.getByRole('button', { name: i18n._('loops.save-region') })
    )
    const input = screen.getByLabelText(i18n._('common.name'))
    await user.clear(input)
    await user.type(input, 'Refrain')
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))

    expect(onSaveRegion).toHaveBeenCalledWith('Refrain', region)
  })

  it('discards a throwaway selection', async () => {
    const user = userEvent.setup()
    const onClearRegion = vi.fn()
    renderControls({ onClearRegion })

    await user.click(
      screen.getByRole('button', { name: i18n._('loops.clear-region') })
    )
    expect(onClearRegion).toHaveBeenCalledOnce()
  })
})
