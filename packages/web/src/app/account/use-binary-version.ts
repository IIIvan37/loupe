import { useEffect, useState } from 'react'
import { isServerShell } from '../../lib/server-shell.ts'

/** What the serving binary knows about versions (AR.2 + update notice):
 * its own, and the strictly newer published release its startup check
 * found, if any. */
export interface BinaryVersionInfo {
  readonly version?: string
  readonly latest?: string
}

const UNKNOWN: BinaryVersionInfo = {}

/** The serving binary's version info, read once from its own `/version` —
 * empty in the plain browser (there is no binary to ask), until the answer
 * lands, or when the endpoint fails (an older binary): the bug-report link
 * then simply asks the tester for `loupe --version` instead. */
export function useBinaryVersion(): BinaryVersionInfo {
  const [info, setInfo] = useState<BinaryVersionInfo>(UNKNOWN)
  useEffect(() => {
    if (!isServerShell()) {
      return
    }
    const controller = new AbortController()
    const read = async () => {
      try {
        const response = await fetch('/version', { signal: controller.signal })
        const body: unknown = response.ok ? await response.json() : undefined
        const candidate = body as
          | { version?: unknown; latest?: unknown }
          | undefined
        if (typeof candidate?.version === 'string') {
          setInfo({
            version: candidate.version,
            ...(typeof candidate.latest === 'string'
              ? { latest: candidate.latest }
              : {})
          })
        }
      } catch {
        // Unreachable or aborted: keep unknown, the link asks for it.
      }
    }
    void read()
    return () => controller.abort()
  }, [])
  return info
}
