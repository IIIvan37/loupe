// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { EmptyState } from './empty-state.tsx'

function renderEmptyState(
  overrides: Partial<Parameters<typeof EmptyState>[0]> = {}
) {
  const user = userEvent.setup()
  const onImport = vi.fn()
  render(<EmptyState onImport={onImport} {...overrides} />, {
    wrapper: I18nTestingProvider
  })
  return { user, onImport }
}

describe('EmptyState', () => {
  it('shows the drop-zone headline', () => {
    renderEmptyState()
    expect(screen.getByText(i18n._('empty.headline'))).toBeInTheDocument()
  })

  it('opens the picker from the primary import action', async () => {
    const { user, onImport } = renderEmptyState()
    await user.click(screen.getByRole('button', { name: i18n._('empty.import') }))
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('sells the three value hooks (not a shortcut table)', () => {
    renderEmptyState()
    expect(
      screen.getByText(i18n._('empty.hook-separate-title'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n._('empty.hook-detect-title'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n._('empty.hook-loop-title'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n._('empty.hook-loop-desc'))
    ).toBeInTheDocument()
  })

  it('hides the URL field in the browser (no onImportUrl)', () => {
    renderEmptyState()
    expect(
      screen.queryByLabelText(i18n._('import.url-field'))
    ).not.toBeInTheDocument()
  })

  it('imports a pasted supported link at the file level (desktop)', async () => {
    const onImportUrl = vi.fn()
    const { user } = renderEmptyState({ onImportUrl })
    const field = screen.getByLabelText(i18n._('import.url-field'))
    await user.click(field)
    await user.paste('https://youtu.be/dQw4w9WgXcQ')
    await user.click(
      screen.getByRole('button', { name: i18n._('import.url-submit') })
    )
    expect(onImportUrl).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ')
  })

  it('seeds the field when a supported link is pasted anywhere on the hero', () => {
    renderEmptyState({ onImportUrl: vi.fn() })
    const field = screen.getByLabelText<HTMLInputElement>(
      i18n._('import.url-field')
    )
    fireEvent.paste(screen.getByRole('heading', { level: 2 }).parentElement!, {
      clipboardData: { getData: () => 'https://youtu.be/dQw4w9WgXcQ' }
    })
    expect(field.value).toBe('https://youtu.be/dQw4w9WgXcQ')
  })
})
