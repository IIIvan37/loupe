# packages/web — conventions

## UI copy goes through Lingui

Explicit semantic ids (`t({ id: 'header.import', message: 'Importer' })`,
`<Trans id="…">`), French source catalog
`packages/web/src/locales/fr/messages.po`, **infinitive forms** (no
tutoiement/vouvoiement). After changing copy run
`pnpm --filter @app/web i18n:extract` (it overwrites the source-locale msgstr —
required whenever a message changes). **`check:i18n` in the gate enforces it**:
it re-extracts and fails on a diff. Reference comments carry no line numbers
(`lingui.config.ts`), so a diff always means a real change of copy. Specs never
hardcode copy: they resolve keys via `i18n._('id', values)` under the
`I18nTestingProvider` wrapper (see the `react-testing-patterns` and
`lingui-best-practices` skills).
