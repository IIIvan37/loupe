// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAnalysisToken,
  ensureAnalysisToken
} from '../../audio/analysis-token.ts'
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
  /** Push a live auth change to the hook's `onChange` listener (sign-in). */
  emitChange: (state: AuthState) => void
} {
  let listener: ((state: AuthState) => void) | undefined
  return {
    currentState: async () => over.state ?? { status: 'signed-out' },
    onChange: (cb) => {
      listener = cb
      return () => {
        listener = undefined
      }
    },
    accountStatus: async () => over.status,
    sendMagicLink: vi.fn(async () => {}),
    redeemBetaCode: vi.fn(async () => over.redeem ?? 'redeemed'),
    signOut: vi.fn(async () => {}),
    mintToken: async () => ({ ok: false as const, reason: 'error' as const }),
    emitChange: (state) => listener?.(state)
  }
}

/** Render the menu open, controlled — mirrors how the slot always drives it. */
function renderMenu(auth: AuthPort, notice?: string, onSignedIn?: () => void) {
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <AccountMenu
        auth={auth}
        open={open}
        onOpenChange={setOpen}
        notice={notice}
        onSignedIn={onSignedIn}
      />
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
  it('signed out: sends a magic link, then confirms with the address', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth()
    renderMenu(auth)

    await user.type(
      await screen.findByLabelText(i18n._('account.email')),
      'ivan@loupe.test'
    )
    await user.click(screen.getByRole('button', { name: i18n._('account.send-link') }))

    expect(auth.sendMagicLink).toHaveBeenCalledWith('ivan@loupe.test')
    expect(
      await screen.findByText(
        i18n._('account.link-sent-to', { sentTo: 'ivan@loupe.test' })
      )
    ).toBeInTheDocument()
  })

  it('sent state: « Renvoyer » is on cooldown, then resends', async () => {
    // Fake timers + fireEvent (not userEvent/findBy, whose async polling timer
    // would itself be faked and hang); try/finally restores real timers so a
    // failure can't leak fakes into the next test.
    vi.useFakeTimers()
    try {
      const auth = fakeAuth()
      renderMenu(auth)

      fireEvent.change(screen.getByLabelText(i18n._('account.email')), {
        target: { value: 'ivan@loupe.test' }
      })
      fireEvent.click(
        screen.getByRole('button', { name: i18n._('account.send-link') })
      )
      // Flush the sendMagicLink promise → linkPhase 'sent'.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Just sent: « Renvoyer dans 30 s », disabled — no burning the rate limit.
      expect(
        screen.getByRole('button', {
          name: i18n._('account.resend-in', { secondsLeft: 30 })
        })
      ).toBeDisabled()

      // The cooldown ticks down and frees the button.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      const ready = screen.getByRole('button', { name: i18n._('account.resend') })
      expect(ready).toBeEnabled()
      fireEvent.click(ready)
      expect(auth.sendMagicLink).toHaveBeenCalledTimes(2)
      expect(auth.sendMagicLink).toHaveBeenLastCalledWith('ivan@loupe.test')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sent state: « Changer d\'adresse » returns to the email field', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth()
    renderMenu(auth)

    await user.type(
      await screen.findByLabelText(i18n._('account.email')),
      'ivan@loupe.test'
    )
    await user.click(screen.getByRole('button', { name: i18n._('account.send-link') }))
    await screen.findByRole('button', { name: i18n._('account.change-email') })

    await user.click(
      screen.getByRole('button', { name: i18n._('account.change-email') })
    )
    // Back to the input, pre-filled so the user can correct it.
    expect(await screen.findByLabelText(i18n._('account.email'))).toHaveValue(
      'ivan@loupe.test'
    )
  })

  it('resumes the gated analysis once, on the sign-in transition', async () => {
    const onSignedIn = vi.fn()
    const auth = fakeAuth()
    renderMenu(auth, undefined, onSignedIn)
    // Let the mount settle (currentState resolves signed-out).
    await screen.findByLabelText(i18n._('account.email'))

    expect(onSignedIn).not.toHaveBeenCalled()
    await act(async () => {
      auth.emitChange(SIGNED_IN)
    })
    expect(onSignedIn).toHaveBeenCalledTimes(1)

    // A second change while already signed in does not re-fire.
    await act(async () => {
      auth.emitChange(SIGNED_IN)
    })
    expect(onSignedIn).toHaveBeenCalledTimes(1)
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
    expect(
      await screen.findByText(i18n._('account.code-invalid'))
    ).toBeInTheDocument()
  })

  it('updates the quota chip live when an analysis reports new usage', async () => {
    const auth = fakeAuth({
      state: SIGNED_IN,
      status: { member: true, used: 3, quota: 20 }
    })
    renderMenu(auth)
    expect(await screen.findByText('3/20')).toBeInTheDocument()

    // A completed analysis mints a token and reports fresh usage; the gate's
    // pub-sub pushes it to the chip without a reload.
    vi.stubEnv('VITE_ANALYSIS_URL', 'https://modal.example')
    clearAnalysisToken()
    const minting = {
      ...auth,
      mintToken: async () => ({
        ok: true as const,
        token: 't',
        expiresAt: 9_000_000_000,
        used: 4,
        quota: 20
      })
    }
    await act(async () => {
      await ensureAnalysisToken(minting)
    })
    expect(await screen.findByText('4/20')).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('renders the gate notice atop the popover', async () => {
    renderMenu(fakeAuth(), 'Se connecter pour analyser.')
    expect(
      await screen.findByText('Se connecter pour analyser.')
    ).toBeInTheDocument()
  })
})
