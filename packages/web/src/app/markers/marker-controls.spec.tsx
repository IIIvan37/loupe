// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { MarkerControls } from './marker-controls.tsx'

describe('MarkerControls', () => {
  it('drops a marker at the playhead', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<MarkerControls disabled={false} onAdd={onAdd} />, {
      wrapper: I18nTestingProvider
    })

    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('disables the control until a track is ready', () => {
    render(<MarkerControls disabled onAdd={() => {}} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('button', { name: i18n._('markers.add') })
    ).toBeDisabled()
  })
})
