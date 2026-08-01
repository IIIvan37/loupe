import { useEffect, useState } from 'react'
import { isServerShell } from '../../lib/server-shell.ts'

/** The serving binary's version (AR.2), read once from its own `/version` —
 * `undefined` in the plain browser (there is no binary to ask), until the
 * answer lands, or when the endpoint fails (an older binary): the bug-report
 * link then simply asks the tester for `loupe --version` instead. */
export function useBinaryVersion(): string | undefined {
  const [version, setVersion] = useState<string>()
  useEffect(() => {
    if (!isServerShell()) {
      return
    }
    const controller = new AbortController()
    const read = async () => {
      try {
        const response = await fetch('/version', { signal: controller.signal })
        const body: unknown = response.ok ? await response.json() : undefined
        const candidate = (body as { version?: unknown } | undefined)?.version
        if (typeof candidate === 'string') {
          setVersion(candidate)
        }
      } catch {
        // Unreachable or aborted: keep undefined, the link asks for it.
      }
    }
    void read()
    return () => controller.abort()
  }, [])
  return version
}
