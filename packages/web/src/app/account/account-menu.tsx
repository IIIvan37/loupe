import { Popover } from '@base-ui-components/react/popover'
import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactNode, useId, useState } from 'react'
import type { AuthPort } from '../../auth/auth-port.ts'
import { useAuth } from '../../auth/use-auth.ts'
import { cx } from '../../lib/cx.ts'
import styles from './account-menu.module.css'

interface AccountMenuProps {
  readonly auth: AuthPort
  /** Controlled open — the analysis gate opens the menu with a notice. */
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** A reason the menu was opened (sign-in needed, quota spent…), shown atop. */
  readonly notice?: ReactNode
}

/**
 * The header account control (J2). Signed out it invites sign-in; signed in it
 * shows the email + this month's quota, collects a beta code when the user is
 * not yet a member, and signs out. The popover is one surface: after the
 * magic-link step the same panel offers code redemption ("same popover, after
 * sign-in"). Auth is a web concern — `auth` is injected so specs drive it with
 * a fake, and none of this reaches the pure core.
 */
/** The monthly quota read-out — a separate node so `{used}`/`{quota}` extract as
 * NAMED placeholders (member expressions would extract as positional `{0}`). */
function QuotaLine({ used, quota }: { used: number; quota: number }) {
  return (
    <p className={styles.hint}>
      <Trans id="account.quota-this-month">
        Analyses ce mois : {used}/{quota}
      </Trans>
    </p>
  )
}

export function AccountMenu({
  auth,
  open,
  onOpenChange,
  notice
}: AccountMenuProps) {
  const { t } = useLingui()
  const { state, status, linkPhase, redeemPhase, sendMagicLink, signOut, redeemCode } =
    useAuth(auth)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const emailId = useId()
  const codeId = useId()

  const signedIn = state.status === 'signed-in'
  const trigger = signedIn ? (
    <>
      <span className={styles.email}>{state.session.email}</span>
      {status && (
        <span className={styles.quota}>
          {status.used}/{status.quota}
        </span>
      )}
    </>
  ) : (
    <Trans id="account.sign-in">Se connecter</Trans>
  )

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className={cx(styles.trigger)}
        aria-label={t({ id: 'account.menu', message: 'Compte' })}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={cx(styles.positioner)} sideOffset={6}>
          <Popover.Popup className={cx(styles.popup)}>
            {notice && <p className={styles.notice}>{notice}</p>}

            {!signedIn && (
              <form
                className={styles.section}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (email.trim() !== '') {
                    sendMagicLink(email.trim())
                  }
                }}
              >
                <Popover.Title className={cx(styles.title)}>
                  <Trans id="account.sign-in-title">
                    Se connecter pour analyser
                  </Trans>
                </Popover.Title>
                {linkPhase === 'sent' ? (
                  <p className={styles.hint}>
                    <Trans id="account.link-sent">
                      Lien de connexion envoyé — ouvrir l'email pour continuer.
                    </Trans>
                  </p>
                ) : (
                  <>
                    <label className={styles.label} htmlFor={emailId}>
                      <Trans id="account.email">Email</Trans>
                    </label>
                    <input
                      id={emailId}
                      className={styles.input}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {linkPhase === 'error' && (
                      <p className={styles.error} role="alert">
                        <Trans id="account.link-error">
                          Envoi impossible — réessayer.
                        </Trans>
                      </p>
                    )}
                    <button
                      type="submit"
                      className={styles.submit}
                      disabled={linkPhase === 'sending'}
                    >
                      <Trans id="account.send-link">Recevoir un lien</Trans>
                    </button>
                  </>
                )}
              </form>
            )}

            {signedIn && (
              <div className={styles.section}>
                <Popover.Title className={cx(styles.title)}>
                  {state.session.email}
                </Popover.Title>
                {status && <QuotaLine used={status.used} quota={status.quota} />}

                {status && !status.member && (
                  <form
                    className={styles.redeem}
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (code.trim() !== '') {
                        redeemCode(code.trim())
                      }
                    }}
                  >
                    <label className={styles.label} htmlFor={codeId}>
                      <Trans id="account.beta-code">Code beta</Trans>
                    </label>
                    <input
                      id={codeId}
                      className={styles.input}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    {redeemPhase === 'invalid' && (
                      <p className={styles.error} role="alert">
                        <Trans id="account.code-invalid">
                          Code invalide ou déjà utilisé.
                        </Trans>
                      </p>
                    )}
                    {redeemPhase === 'error' && (
                      <p className={styles.error} role="alert">
                        <Trans id="account.code-error">
                          Vérification impossible — réessayer.
                        </Trans>
                      </p>
                    )}
                    <button
                      type="submit"
                      className={styles.submit}
                      disabled={redeemPhase === 'redeeming'}
                    >
                      <Trans id="account.redeem">Valider le code</Trans>
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => signOut()}
                >
                  <Trans id="account.sign-out">Se déconnecter</Trans>
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
