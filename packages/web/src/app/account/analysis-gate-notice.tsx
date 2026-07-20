import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { appAuth } from '../../auth/app-auth.ts'
import type { AuthPort } from '../../auth/auth-port.ts'
import { useAuth } from '../../auth/use-auth.ts'
import { cx } from '../../lib/cx.ts'
import styles from './analysis-gate-notice.module.css'

/**
 * The upstream half of AK.4: a single quiet line at the head of the Analyse
 * zone that discloses the beta gate *before* the user clicks a Detect button
 * and only then discovers it. It reads the same `AuthPort` the click-time gate
 * mints against, so the two never disagree. The Detect buttons stay clickable —
 * a click still opens the account menu (and AK.1 resumes after sign-in); this
 * only removes the surprise.
 *
 * Renders nothing once the analyses are actually reachable (member with quota),
 * while the signed-in status is still loading (no flicker), or when Supabase is
 * unconfigured (`auth` null — local/token-less dev). Quota-exhaustion is left to
 * the click-time notice: it is a transient monthly state, not a "you can't start"
 * disclosure.
 */
export function AnalysisGateNotice({
  auth = appAuth()
}: {
  /** Injected in tests; defaults to the app singleton (null when unconfigured). */
  readonly auth?: AuthPort | null
}) {
  if (auth === null) {
    return null
  }
  return <GatedNotice auth={auth} />
}

function GatedNotice({ auth }: { readonly auth: AuthPort }) {
  const { state, status } = useAuth(auth)

  let message: ReactNode
  if (state.status === 'signed-out') {
    message = (
      <Trans id="analysis.locked-sign-in">
        Connectez-vous pour débloquer les analyses.
      </Trans>
    )
  } else if (status !== undefined && !status.member) {
    message = (
      <Trans id="analysis.locked-beta">
        Entrez un code beta pour débloquer les analyses.
      </Trans>
    )
  }

  if (message === undefined) {
    return null
  }
  return (
    <p className={cx(styles.notice)}>
      <span className={cx(styles.lock)} aria-hidden="true">
        <LockIcon />
      </span>
      {message}
    </p>
  )
}

/** A small padlock — the "gated" cue, tinted amber via currentColor. */
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}
