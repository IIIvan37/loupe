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

  it('drops a SECTION marker at the playhead', async () => {
    // Structure markers were only born from detection or typed [headers];
    // « + Section » lets the user lay the song's structure out by hand.
    const user = userEvent.setup()
    const onAddSection = vi.fn()
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        onAddSection={onAddSection}
      />,
      { wrapper: I18nTestingProvider }
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('markers.add-section') })
    )
    expect(onAddSection).toHaveBeenCalledOnce()
  })

  it('disables + Section with the rest of the control', () => {
    render(<MarkerControls disabled onAdd={() => {}} onAddSection={() => {}} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('button', { name: i18n._('markers.add-section') })
    ).toBeDisabled()
  })

})
