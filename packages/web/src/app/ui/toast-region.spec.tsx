// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ToastRegion } from './toast-region.tsx'
import { useToaster } from './use-toaster.ts'

/** A minimal host: a button that raises a success toast, plus the region. */
function Harness() {
  const { toaster, notifySuccess } = useToaster()
  return (
    <>
      <button type="button" onClick={() => notifySuccess('Projet enregistré')}>
        raise
      </button>
      <ToastRegion toaster={toaster} />
    </>
  )
}

describe('ToastRegion', () => {
  it('raises nothing until asked, then shows the confirmation', async () => {
    const user = userEvent.setup()
    render(<Harness />, { wrapper: I18nTestingProvider })

    expect(screen.queryByText('Projet enregistré')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'raise' }))
    expect(await screen.findByText('Projet enregistré')).toBeInTheDocument()
  })

  it('dismisses a toast from its close button', async () => {
    const user = userEvent.setup()
    render(<Harness />, { wrapper: I18nTestingProvider })
    await user.click(screen.getByRole('button', { name: 'raise' }))
    await screen.findByText('Projet enregistré')

    // Base UI keeps toasts inert until the region is hovered/focused (so a toast
    // never steals focus); the close button only becomes interactive then.
    await user.hover(
      screen.getByRole('region', { name: i18n._('toast.region') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('toast.dismiss') })
    )
    await waitFor(() =>
      expect(screen.queryByText('Projet enregistré')).not.toBeInTheDocument()
    )
  })
})
