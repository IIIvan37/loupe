import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  // French IS the product language for now — the source catalog doubles as
  // the shipped one. Adding a locale = add it here, translate the .po.
  sourceLocale: 'fr',
  locales: ['fr'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
      exclude: ['**/*.spec.*', '**/node_modules/**']
    }
  ],
  orderBy: 'messageId',
  // Reference comments keep the file path, drop the `:line`. A line number
  // churns on every edit above a message, which would make `check:i18n`
  // (extract + diff) fire on changes that touch no copy at all — noise that
  // teaches you to ignore the check. Without them, a diff means what it says:
  // a message was added, changed, removed, or moved to another file.
  format: formatter({ lineNumbers: false })
})
