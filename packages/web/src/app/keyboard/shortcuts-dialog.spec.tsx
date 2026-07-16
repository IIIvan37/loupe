// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ShortcutsDialog } from './shortcuts-dialog.tsx'

const HINTS = [
  {
    keys: i18n._('shortcuts.key-space'),
    description: i18n._('shortcuts.play-pause')
  },
  {
    keys: '→',
    description: i18n._('shortcuts.seek-forward', { seconds: 5 })
  }
] as const

describe('ShortcutsDialog', () => {
  it('lists each shortcut as a key/action pair when open', () => {
    render(<ShortcutsDialog open onOpenChange={() => {}} hints={HINTS} />, {
      wrapper: I18nTestingProvider
    })

    expect(screen.getByText(i18n._('shortcuts.key-space'))).toBeInTheDocument()
    expect(screen.getByText(i18n._('shortcuts.play-pause'))).toBeInTheDocument()
    expect(
      screen.getByText(i18n._('shortcuts.seek-forward', { seconds: 5 }))
    ).toBeInTheDocument()
  })

  it('teaches the pointer gestures under their own heading', () => {
    render(<ShortcutsDialog open onOpenChange={() => {}} hints={HINTS} />, {
      wrapper: I18nTestingProvider
    })

    expect(
      screen.getByRole('heading', { name: i18n._('shortcuts.gestures') })
    ).toBeInTheDocument()
  })

  it('documents the drag-to-loop gesture', () => {
    render(<ShortcutsDialog open onOpenChange={() => {}} hints={HINTS} />, {
      wrapper: I18nTestingProvider
    })

    expect(
      screen.getByText(i18n._('shortcuts.gesture-loop'))
    ).toBeInTheDocument()
  })

  it('asks to close when the close button is pressed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <ShortcutsDialog open onOpenChange={onOpenChange} hints={HINTS} />,
      { wrapper: I18nTestingProvider }
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('common.close') })
    )
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
  })

  it('renders nothing while closed', () => {
    render(
      <ShortcutsDialog open={false} onOpenChange={() => {}} hints={HINTS} />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.queryByText(i18n._('shortcuts.title'))
    ).not.toBeInTheDocument()
  })
})
