import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Fitness function for the UI copy (AQ.2): the French catalog carries the
 * product's voice, and drift arrives one harmless string at a time — a raw
 * English word here, a « Cliquez » there. The lexicon is decided (three
 * levels: morceau = imported audio, piste = one separated stem, grille = the
 * chord chart; infinitive mood everywhere), so the catalog is checkable.
 *
 * Deliberate exceptions, NOT blacklisted: « Mix » and « Tap » are assumed
 * musician vocabulary (tap tempo, le mix) — kept as-is by decision (lot AQ).
 */

const CATALOG = fileURLToPath(new URL('./fr/messages.po', import.meta.url))

/** Every translated string of the source catalog (msgstr lines), with ICU
 * placeholders stripped — `{pitch}` is a variable name, not copy. */
function catalogMessages(): readonly { id: string; text: string }[] {
  const po = readFileSync(CATALOG, 'utf8')
  return [...po.matchAll(/msgid "([^"]*)"\nmsgstr "((?:[^"\\]|\\.)*)"/g)].map(
    ([, id, text]) => ({
      id: id ?? '',
      text: (text ?? '').replace(/\{[^}]*\}/g, ' ')
    })
  )
}

/** Banned term → the French the lexicon wants instead. */
const BLACKLIST: readonly { banned: RegExp; instead: string }[] = [
  { banned: /\bstems?\b/i, instead: 'piste(s)' },
  { banned: /\bcharts?\b/i, instead: 'grille' },
  { banned: /\bkey of\b/i, instead: 'Tonalité :' },
  { banned: /\bpitch\b/i, instead: 'hauteur' },
  { banned: /\bbeta\b/, instead: 'bêta' },
  // Imperative/vouvoiement — the UI speaks in the infinitive.
  {
    banned:
      /\b(?:glissez|déposez|collez|cliquez|entrez|choisissez|sélectionnez|importez|validez|connectez)\b/i,
    instead: 'infinitive mood'
  }
]

describe('the French catalog respects the lexicon', () => {
  it.each(BLACKLIST)(
    'never says $banned (use $instead)',
    ({ banned, instead }) => {
      const offenders = catalogMessages().filter(({ text }) =>
        banned.test(text)
      )
      expect(
        offenders.map(({ id, text }) => `${id}: ${text}`),
        `\nBanned term ${banned} — the lexicon wants « ${instead} ».` +
          '\nFix the message in the source code, then run' +
          '\n`pnpm --filter @app/web i18n:extract`.'
      ).toEqual([])
    }
  )

  it('reads a non-empty catalog (the check must not pass vacuously)', () => {
    expect(catalogMessages().length).toBeGreaterThan(100)
  })
})
