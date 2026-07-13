// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AccountStatus,
  AuthPort,
  AuthState,
  RedeemResult
} from '../../auth/auth-port.ts'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { AccountMenu } from './account-menu.tsx'

/** A fake AuthPort with spy actions; session + status are fixed per render. */
function fakeAuth(
  over: {
    state?: AuthState
    status?: AccountStatus
    redeem?: RedeemResult
  } = {}
): AuthPort & {
  sendMagicLink: ReturnType<typeof vi.fn>
  redeemBetaCode: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
} {
  return {
    currentState: async () => over.state ?? { status: 'signed-out' },
    onChange: () => () => {},
    accountStatus: async () => over.status,
    sendMagicLink: vi.fn(async () => {}),
    redeemBetaCode: vi.fn(async () => over.redeem ?? 'redeemed'),
    signOut: vi.fn(async () => {}),
    mintToken: async () => ({ ok: false as const, reason: 'error' as const })
  }
}

/** Render the menu open, controlled — mirrors how the slot always drives it. */
function renderMenu(auth: AuthPort, notice?: string) {
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <AccountMenu auth={auth} open={open} onOpenChange={setOpen} notice={notice} />
    )
  }
  render(<Harness />, { wrapper: I18nTestingProvider })
}

const SIGNED_IN: AuthState = {
  status: 'signed-in',
  session: { email: 'ivan@loupe.test' }
}

// Base UI portals its popup to document.body; unmount between tests so a prior
// test's trigger/popup can't shadow the next one's queries.
afterEach(cleanup)

describe('AccountMenu', () => {
  it('signed out: sends a magic link, then confirms', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth()
    renderMenu(auth)

    await user.type(
      await screen.findByLabelText(i18n._('account.email')),
      'ivan@loupe.test'
    )
    await user.click(screen.getByRole('button', { name: i18n._('account.send-link') }))

    expect(auth.sendMagicLink).toHaveBeenCalledWith('ivan@loupe.test')
    expect(await screen.findByText(i18n._('account.link-sent'))).toBeInTheDocument()
  })

  it('signed-in member: shows the quota, no code field, and signs out', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth({
      state: SIGNED_IN,
      status: { member: true, used: 3, quota: 20 }
    })
    renderMenu(auth)

    expect(
      await screen.findByText(i18n._('account.quota-this-month', { used: 3, quota: 20 }))
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(i18n._('account.beta-code'))).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: i18n._('account.sign-out') }))
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('signed-in non-member: redeems a code', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth({
      state: SIGNED_IN,
      status: { member: false, used: 0, quota: 20 },
      redeem: 'redeemed'
    })
    renderMenu(auth)

    await user.type(
      await screen.findByLabelText(i18n._('account.beta-code')),
      'GOLDEN'
    )
    await user.click(screen.getByRole('button', { name: i18n._('account.redeem') }))
    expect(auth.redeemBetaCode).toHaveBeenCalledWith('GOLDEN')
  })

  it('signed-in non-member: an invalid code is announced', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth({
      state: SIGNED_IN,
      status: { member: false, used: 0, quota: 20 },
      redeem: 'invalid'
    })
    renderMenu(auth)

    await user.type(
      await screen.findByLabelText(i18n._('account.beta-code')),
      'NOPE'
    )
    await user.click(screen.getByRole('button', { name: i18n._('account.redeem') }))
    await waitFor(() =>
      expect(screen.getByText(i18n._('account.code-invalid'))).toBeInTheDocument()
    )
  })

  it('renders the gate notice atop the popover', async () => {
    renderMenu(fakeAuth(), 'Se connecter pour analyser.')
    expect(
      await screen.findByText('Se connecter pour analyser.')
    ).toBeInTheDocument()
  })
})
