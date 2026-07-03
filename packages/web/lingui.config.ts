import { defineConfig } from '@lingui/cli'

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
  orderBy: 'messageId'
})
