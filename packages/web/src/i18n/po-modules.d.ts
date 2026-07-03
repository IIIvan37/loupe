// @lingui/vite-plugin compiles .po catalogs at import time.
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
