// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AccountStatus,
  AuthPort,
  AuthState,
  MintFailureReason
} from '../../auth/auth-port.ts'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { AccountMenuSlot } from './account-menu-slot.tsx'

/** A minimal fake AuthPort — the slot only renders the menu around it. */
function fakeAuth(
  over: { state?: AuthState; status?: AccountStatus } = {}
): AuthPort {
  return {
    currentState: async () => over.state ?? { status: 'signed-out' },
    onChange: () => () => {},
    accountStatus: async () => over.status,
    sendMagicLink: vi.fn(async () => {}),
    redeemBetaCode: vi.fn(async () => 'redeemed' as const),
    signOut: vi.fn(async () => {}),
    mintToken: async () => ({ ok: false as const, reason: 'error' as const })
  }
}

type Reasons = readonly (MintFailureReason | undefined)[]

function renderSlot(gateReasons: Reasons) {
  const view = render(
    <AccountMenuSlot auth={fakeAuth()} gateReasons={gateReasons} />,
    { wrapper: I18nTestingProvider }
  )
  return {
    rerender: (next: Reasons) =>
      view.rerender(<AccountMenuSlot auth={fakeAuth()} gateReasons={next} />)
  }
}

// Base UI portals its popup to document.body; unmount between tests so a prior
// test's popup can't shadow the next one's queries.
afterEach(cleanup)

describe('AccountMenuSlot', () => {
  it('stays closed while no analysis is blocked', () => {
    renderSlot([undefined, undefined, undefined])
    expect(
      screen.queryByText(i18n._('account.gate-sign-in'))
    ).not.toBeInTheDocument()
  })

  it('opens with the prompt when an analysis is blocked at the gate', async () => {
    const { rerender } = renderSlot([undefined, undefined, undefined])
    rerender(['sign-in-required', undefined, undefined])
    expect(
      await screen.findByText(i18n._('account.gate-sign-in'))
    ).toBeInTheDocument()
  })

  it('reopens when ANOTHER flow blocks for the same reason (M1.1)', async () => {
    // Structure blocks → the user closes the menu → the tempo auto-detect
    // blocks for the SAME reason: the comparison is per flow, so the menu
    // pops again — a single combined value would read it as unchanged.
    const { rerender } = renderSlot([undefined, undefined, undefined])
    rerender(['sign-in-required', undefined, undefined])
    const menu = await screen.findByRole('dialog')
    expect(menu).toBeInTheDocument()

    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(['sign-in-required', 'sign-in-required', undefined])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(i18n._('account.gate-sign-in'))
    ).toBeInTheDocument()
  })

  it('maps the quota reason to its own prompt', async () => {
    const { rerender } = renderSlot([undefined, undefined, undefined])
    rerender([undefined, 'quota-exceeded', undefined])
    expect(
      await screen.findByText(i18n._('account.gate-quota'))
    ).toBeInTheDocument()
  })
})
