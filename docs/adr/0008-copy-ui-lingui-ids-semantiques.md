# ADR 0008 — La copy UI passe par Lingui : ids sémantiques, catalogue source français, infinitifs

- **Statut** : accepté
- **Date** : 2026-07-03 (décisions confirmées en session
  [i18n-lingui](../sessions/2026-07-03-i18n-lingui.md) ; rédigé a posteriori
  le 2026-07-24, lot TS.3)

## Contexte

Toute la copy de `packages/web` était des littéraux français en dur dans les
composants — et dans les specs, qui les répétaient : chaque reformulation
cassait des tests, et aucune seconde langue n'était possible sans réécrire
l'UI. La migration vers un système d'i18n posait quatre questions qui, sans
décision écrite, se seraient re-tranchées différemment à chaque PR : quel
outil, quels identifiants de messages, quelle langue source, quel ton.

## Décision

- **Lingui, workflow canonique** : macros dans les composants
  (`t({ id, message })`, `<Trans id="…">`, `msg()` au niveau module),
  extraction vers le catalogue, catalogues **compilés à l'import** par
  `@lingui/vite-plugin` — aucun artefact généré dans git.
- **Ids sémantiques explicites** (`header.import`), jamais des ids dérivés du
  texte : la copy peut changer sans invalider l'id, et l'id documente
  l'emplacement.
- **Le français est la locale source** ; le catalogue
  `packages/web/src/locales/fr/messages.po` est la source de vérité de la
  copy. Après tout changement : `pnpm --filter @app/web i18n:extract`
  (`--overwrite --clean` — obligatoire pour que la locale source suive).
- **Formes infinitives** — ni tutoiement ni vouvoiement (« Importer un
  morceau… », « Reprendre un projet enregistré… »).
- **Les specs résolvent les clés, jamais la copy** : `i18n._('id', values)`
  sous `I18nTestingProvider`, vrai catalogue, pas de mock — un changement de
  formulation ne casse aucun test, et l'interpolation est exercée pour de
  vrai (guidance officielle Lingui, vendorée en skill
  `lingui-best-practices` ; idiome dans `react-testing-patterns`).

## Conséquences

- Une seconde locale = l'ajouter à `lingui.config.ts`, traduire le `.po`,
  charger le catalogue + un switcher — le runtime est déjà réactif.
- Le ton est uniforme et vérifiable : une chaîne au tutoiement dans un diff
  est un défaut, pas une nuance.
- Coût de cérémonie réel : chaque libellé passe par une macro et un id, et
  l'oubli d'`i18n:extract` désynchronise le catalogue (le workflow est écrit
  dans CLAUDE.md).
- Pas de garde outillée contre un littéral en dur réintroduit
  (`eslint-plugin-lingui` ne s'applique pas, le dépôt est sous Biome) — la
  règle CLAUDE.md et la revue portent l'invariant.

## Alternatives envisagées

- **Rester en littéraux français en dur.** C'est l'état d'avant : copy
  répétée dans les specs (tests cassés à chaque reformulation), seconde
  langue impossible. Rejeté.
- **Ids générés (hash du message).** Zéro cérémonie de nommage, mais l'id
  change avec le texte — l'historique de traduction se perd à chaque
  reformulation et les specs ne peuvent pas cibler une clé stable. Rejeté au
  profit des ids sémantiques explicites.
- **Mocker i18n dans les specs.** Plus simple en apparence, mais ne teste ni
  le catalogue ni l'interpolation, et les noms accessibles divergent du
  runtime. Rejeté — guidance officielle Lingui à l'appui.
- **Compiler les catalogues dans git.** Rejeté : les artefacts générés
  restent hors du dépôt ; ici il n'en existe aucun (compilation à l'import).
