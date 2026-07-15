// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import { OperationStatus } from './operation-status.tsx'

function renderStatus(
  props: Partial<Parameters<typeof OperationStatus>[0]> = {}
) {
  return render(<OperationStatus label="Détection…" {...props} />, {
    wrapper: I18nTestingProvider
  })
}

describe('OperationStatus', () => {
  it('shows an indeterminate bar and the label while no real progress exists', () => {
    renderStatus()
    expect(screen.getByText('Détection…')).toBeInTheDocument()
    // No value attribute = the native indeterminate progress state.
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
    // No percentage read-out to lie with.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('shows the real progress when the flow streams one', () => {
    renderStatus({ progress: 0.4 })
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40')
    // The visible read-out beside the label (the progress fallback text is
    // hidden inside the element).
    expect(screen.getByText('40%', { selector: 'span' })).toBeInTheDocument()
  })

  it('offers Annuler only when the operation is cancellable', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { rerender } = renderStatus({ onCancel })
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )
    expect(onCancel).toHaveBeenCalledOnce()

    rerender(<OperationStatus label="Détection…" />)
    expect(
      screen.queryByRole('button', { name: i18n._('common.cancel') })
    ).not.toBeInTheDocument()
  })

  describe('deferred detail line', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('surfaces the detail only after the wait grows suspicious', () => {
      renderStatus({
        detail: 'Démarrage du moteur…',
        detailAfterMs: 4000
      })
      expect(screen.queryByText('Démarrage du moteur…')).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(4000))
      expect(screen.getByText('Démarrage du moteur…')).toBeInTheDocument()
    })

    it('shows an undeferred detail straight away', () => {
      renderStatus({ detail: 'Démarrage du moteur…' })
      expect(screen.getByText('Démarrage du moteur…')).toBeInTheDocument()
    })
  })
})
