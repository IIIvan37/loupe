// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  AccountStatus,
  AuthPort,
  AuthState
} from '../../auth/auth-port.ts'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { AnalysisGateNotice } from './analysis-gate-notice.tsx'

/** A fixed-snapshot AuthPort — the notice only reads `state` + `status`. */
function fakeAuth(over: { state?: AuthState; status?: AccountStatus }): AuthPort {
  return {
    currentState: async () => over.state ?? { status: 'signed-out' },
    onChange: () => () => {},
    accountStatus: async () => over.status,
    sendMagicLink: async () => {},
    signOut: async () => {},
    redeemBetaCode: async () => 'redeemed',
    mintToken: async () => ({ ok: false, reason: 'error' })
  }
}

const SIGNED_IN: AuthState = {
  status: 'signed-in',
  session: { email: 'ivan@loupe.test' }
}

function renderNotice(auth: AuthPort | null) {
  render(<AnalysisGateNotice auth={auth} />, { wrapper: I18nTestingProvider })
}

describe('AnalysisGateNotice', () => {
  it('discloses sign-in when signed out', async () => {
    renderNotice(fakeAuth({ state: { status: 'signed-out' } }))
    expect(
      await screen.findByText(i18n._('analysis.locked-sign-in'))
    ).toBeInTheDocument()
  })

  it('discloses the beta code for a signed-in non-member', async () => {
    renderNotice(
      fakeAuth({
        state: SIGNED_IN,
        status: { member: false, used: 0, quota: 20 }
      })
    )
    expect(
      await screen.findByText(i18n._('analysis.locked-beta'))
    ).toBeInTheDocument()
  })

  it('stays silent for a member (analyses reachable)', async () => {
    renderNotice(
      fakeAuth({
        state: SIGNED_IN,
        status: { member: true, used: 3, quota: 20 }
      })
    )
    // The status resolves async; give it a tick, then assert neither line shows.
    await waitFor(() =>
      expect(
        screen.queryByText(i18n._('analysis.locked-beta'))
      ).not.toBeInTheDocument()
    )
    expect(
      screen.queryByText(i18n._('analysis.locked-sign-in'))
    ).not.toBeInTheDocument()
  })

  it('renders nothing when auth is unconfigured (null)', () => {
    const { container } = render(<AnalysisGateNotice auth={null} />, {
      wrapper: I18nTestingProvider
    })
    expect(container).toBeEmptyDOMElement()
  })
})
