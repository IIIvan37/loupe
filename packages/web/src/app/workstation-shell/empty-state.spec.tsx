// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { EmptyState } from './empty-state.tsx'

function renderEmptyState(onImport = vi.fn()) {
  const user = userEvent.setup()
  render(<EmptyState onImport={onImport} />, {
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
})
