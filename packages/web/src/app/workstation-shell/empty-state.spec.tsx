// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { EmptyState } from './empty-state.tsx'

const SHORTCUTS = [
  { keys: 'Espace', description: 'Lecture / pause' },
  { keys: 'M', description: 'Poser un repère' }
]

function renderEmptyState(onImport = vi.fn()) {
  const user = userEvent.setup()
  render(<EmptyState onImport={onImport} shortcuts={SHORTCUTS} />, {
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

  it('lists the visible keyboard shortcuts', () => {
    renderEmptyState()
    expect(screen.getByText('Espace')).toBeInTheDocument()
    expect(screen.getByText('Lecture / pause')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('Poser un repère')).toBeInTheDocument()
  })
})
