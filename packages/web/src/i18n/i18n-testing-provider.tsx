import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { i18n } from './i18n.ts'

/**
 * The Lingui-recommended custom-renderer wrapper for specs: the REAL i18n
 * instance with the French source catalog loaded — no mocking, so tests
 * exercise the exact strings (and ICU interpolation) users get. Pass it as
 * `wrapper` to render()/renderHook().
 */
export function I18nTestingProvider({
  children
}: {
  readonly children: ReactNode
}) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
