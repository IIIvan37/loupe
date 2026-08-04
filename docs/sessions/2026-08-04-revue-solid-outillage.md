# Session — 2026-08-04 — revue SOLID, lot 4 (outillage)

Le solde du § « Backlog outillage » du rapport `2026-08-04-revue-solid.md` :
rendre mécanique ce que la revue a montré détectable, dans l'idiome maison
(fitness function en spec + cliquet, auto-tests du détecteur, allowlists
triées et commentées — le patron d'`unit-discipline.spec.ts`).

## Done

- **`variant-discipline.spec.ts`** (OCP, actions n° 1–3) : vocabulaire fermé
  (un jeu de littéraux = un module propriétaire ; transport + phases),
  actions câblées (chaque variante d'un reducer exporté du core exige un
  site de dispatch web — littéraux extraits de l'union, la liste ne peut pas
  vieillir), cliquet disjonctions ≥ 3 littéraux épinglé à 0. **Première
  prise dès la naissance** : la variante `toggle` de `TransportAction`
  n'était dispatchée nulle part (même classe que le `tick` mort de #361) —
  supprimée, reducer + specs + property test à jour.
- **`contract-discipline.spec.ts`** (LSP, n° 4–5) : tout `*Contract` exporté
  d'un `testing/` doit être rejoué par ≥ 2 specs (référence + adaptateur
  réel — l'ADR 0002 exécutable, le replay ne peut plus se reperdre en
  silence) ; tout double `ProjectStore` fait main hors allowlist est un
  échec. **Deuxième prise** : `use-projects.spec.tsx` re-fabriquait le store
  in-memory à la main avec des refs `ref-${n++}` hors domaine — convergé sur
  `createInMemoryProjectStore` + `sha256Hex`.
- **`port-discipline.spec.ts`** (ISP, n° 6) : méthodes optionnelles des
  ports core épinglées à 3 (`spectrum?()` ×2, `setStemFilter?()` —
  l'héritage d'avant les seams), cliquet descendant ; les champs de données
  optionnels restent hors périmètre (forme de valeur, pas identité
  d'interface).
- **`adr-pointers.spec.ts`** (SRP/DIP, n° 8) : toute référence `ADR NNNN`
  dans les sources (core, web, sheriff.config) doit résoudre vers un dossier
  `docs/adr/NNNN-*.md` — une défense pointant un ADR disparu n'existe plus.
- **Biome `useExhaustiveSwitchCases`** (nursery, domaine types, n° 2)
  activée en `error` : zéro violation existante — le `satisfies never`
  devient mécanique pour tout futur switch.
- **`mutation:diff` étendu aux hooks web** (n° 7) : un `use-*.ts[x]` touché
  par la branche est muté fichier par fichier (le détecteur général
  d'altitude/pass-through). Prouvé sur un hook réel : mutants tués par les
  specs jsdom sous le runner vitest, 1 min 23.
- **Workflow `/revue-solid` gelé** (n° 10) : `.claude/workflows/revue-solid.js`
  (5 enquêteurs calibrés FP + sceptiques adversariaux), historique récent
  paramétré par `args.history` — rejouable à chaque fin de chantier.
- Périmètre outillé : `.claude/` exclu de Biome et Knip (les scripts de
  workflow suivent les règles du runtime, pas celles de l'app).

## Not done / remaining

- Cliquet « largeur des interfaces de deps » (2e moitié du n° 6) : non posé —
  le compte de membres par interface demande un vrai parseur, le rapport
  coût/signal est mauvais tant que les seams `Pick` (PR #369) tiennent.

## Decisions

- Un détecteur lexical s'attrape lui-même (sa config épelle les jeux) :
  l'auto-exclusion du fichier détecteur est le geste standard, pas une
  entrée d'allowlist.
- Le smell ISP mécanisable est la méthode optionnelle, PAS le champ de
  données optionnel — le premier est une interface qui avoue être
  plusieurs, le second une forme de valeur.

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,41 % lines (4 nouveaux specs de fitness,
  44 cas)
- mutation (Stryker, `test:mutation:diff`, périmètre nursery + hook web
  via le script étendu) : ✅ score 92,34 (seuil 90), 5 min 35 ; l'essai
  hook web isolé à 100 %
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `056aefba`)
- SonarCloud (PR #370) : ✅ quality gate OK, 0 issue, 0 hotspot

## State to resume from

- **Single next action** : après le merge, le chantier revue SOLID est
  intégralement soldé (constats + outillage) — retour au labo starter
  (récolte du module `playback/`), les 4 specs de discipline et le workflow
  gelé sont les premières pièces à porter au template.
- Gotchas : les cliquets vivent dans les specs eux-mêmes
  (`OPTIONAL_MEMBERS_PIN = 3`, chaîne de disjonctions = 0) ; toute descente
  se ratchette dans la même PR ; `.claude/**` est hors Biome/Knip.
