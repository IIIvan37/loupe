# Plan — resynchronisation avec le template `hexagonal-tdd-starter`

Loupe a été créé le 2026-06-28 depuis `IIIvan37/hexagonal-tdd-starter`
(snapshot = commit initial `948e39b`). Le template a beaucoup évolué depuis —
et son ADR-0006 (« emergent feature modules ») a précisément été conçu à partir
de l'analyse du core de Loupe (49 fichiers domain à plat, `ports.ts` de
306 lignes, noyau de facto `beat-grid`, deux cycles conceptuels). Objectif :
**adoption complète** des nouveautés du template.

## Contraintes

- **Pas d'historique git commun** (repo « from template ») → pas de merge
  direct. Méthode : remote `template` + merge 3-voies **par fichier** avec
  `948e39b` comme base (`git merge-file`), ou réécriture adaptée quand le
  fichier a divergé des deux côtés.
- Les deux côtés ont modifié : skills, `ci.yml`, `pre-commit`, `biome.json`,
  `sheriff.config.ts` → réconciliation, jamais de copie aveugle.
- Ne s'appliquent pas : exemple `greet`, `packages/cli`, `scripts/eject-example.ts`,
  README/CONTRIBUTING de bootstrap.
- Un lot = une branche + PR + session report ; gate verte à chaque étape.

## Lots

### TS.1 — Configs & outillage (mécanique, faible risque)

- `tsconfig.base.json` : `erasableSyntaxOnly` (vérifié : aucune violation dans
  les sources actuelles).
- `tsconfig.json` : `include` docs/scripts ; le path `@app/core/testing`
  viendra avec TS.4. Reprendre le commentaire « paths LOAD-BEARING pour
  Sheriff ».
- `.jscpd.json` (ignore `*.spec.*`), `.gitattributes` (fix CRLF prouvé par la
  gate Windows du template), `.vscode/settings.json`,
  `.github/PULL_REQUEST_TEMPLATE.md`.
- `pnpm-workspace.yaml` : overrides d'advisories (fast-uri, brace-expansion) —
  vérifier leur pertinence actuelle avec `pnpm audit`.
- `biome.json` : migration schéma 2.5.5 + règles ajoutées côté template
  (merge 3-voies avec les overrides Loupe : Lingui, react, useLatest…).
- `.husky/pre-commit` : fast-path doc-only (qui exécute quand même
  `docs.spec.ts`) + formatage sûr des fichiers partiellement stagés.
- `.github/workflows/ci.yml` : `workflow_dispatch`, job `audit`
  (`pnpm audit --audit-level high`), cache incrémental Stryker + artefact du
  rapport HTML, `setup-node@v7`. Décision : la gate Windows post-merge a du
  sens ici (app desktop Tauri) — à activer.
- Skills `.claude/skills/` : réconcilier `new-feature-hexa`, `quality-gate`,
  `session-report`, `tdd-cycle` (évolutions des deux côtés ; les skills
  Loupe-only — lingui, react-* — ne bougent pas). Inclut la ligne « rule of
  three » de découverte de modules dans `session-report`.

### TS.2 — Fitness functions (invariants auto-testés)

- `packages/core/src/purity.spec.ts` : détecteur d'état ambiant
  (`Math.random`, `Date.now`, accès calculés…) — vérifié : core actuel propre,
  adoption directe.
- `packages/core/src/public-surface.spec.ts` : chaque export **valeur** de
  `index.ts` (334 lignes) doit avoir un consommateur hors core — fera
  probablement tomber des exports orphelins : les retirer (c'est le but).
- `docs/docs.spec.ts` : bornes STATUS ≤ 60 lignes non vides, ≤ 5 session
  reports actifs → créer `docs/sessions/archive/` et y déplacer l'historique.
  Adapter les bornes si besoin, mais l'esprit (snapshot, pas journal) est déjà
  la pratique Loupe.
- `packages/core/src/shared/result.ts` : adopter le type `Result` partagé ;
  migration des erreurs existantes **au fil de l'eau**, pas en big-bang.

### TS.3 — Pratique ADR

- `docs/adr/` : README + `_TEMPLATE` du template.
- Rédiger les ADR Loupe en important ceux du template qui s'appliquent
  (strip-only TS, port-contracts en subpath testing, état ambiant derrière des
  ports, erreurs = valeurs taguées, modules émergents) + acter les décisions
  Loupe déjà en vigueur qui n'ont que des memories/sessions comme trace
  (ex. Every Layout sans media queries, offload Modal).

### TS.4 — Subpath `@app/core/testing` + port contracts (infrastructure)

- Créer `packages/core/src/testing/index.ts` exposé en subpath
  (`package.json` exports + `tsconfig.json` paths + tag Sheriff
  `core:testing` + override Biome anti-fake-en-prod).
- Écrire le **premier** contrat + fake in-memory sur un port simple pour
  valider la mécanique ; les 24 ports de `ports.ts` seront couverts
  progressivement, chaque extraction de module (TS.5) emportant *ses* ports,
  *ses* contrats et *ses* fakes.

### TS.5 — Modules émergents (le chantier, N PRs)

Mécanisme d'abord, extractions ensuite — une extraction = une PR, procédure
Mikado de l'ADR-0006 (nommer → `git mv` la tranche verticale → laisser Sheriff
énumérer la frontière → revert si > ~2 niveaux de prérequis).

1. **Mécanisme** : règles placeholder Sheriff
   (`core/src/<feature>/{domain,application}`), ratchet « features n'importent
   pas la nursery », `scripts/modules-hint.ts` (clusters de préfixes +
   cohésion d'imports).
2. **Extractions candidates** (ordre = DAG conceptuel
   `audio ← rhythm ← harmony ← structure ← project`, dépendances d'abord) :
   - `rhythm` : beat-grid, manual-tempo, metronome, nudge-time, fine-tune…
   - `harmony` : chord-* ×5, chroma, roman-numeral, harmonic-cycle, chord-key…
   - `structure` : song-structure, section-matching, chart-structure,
     form-encoder…
   - `loops` : loop-region, loop-library, snap-loop-region…
   - `separation` : separation, stems, instrument-detection, analysis-mix…
   - `project` : project, parse-project…
   - promotions `shared/` attendues : median, nearest-time, timecode
     (le « langage temporel » partagé).
3. **Réparer les deux cycles connus au passage** : `section-matching`
   (algorithme générique d'accord de séquences → `shared/` ou module algo) et
   la constante de transport coincée dans `key-bindings` (→ transport).

`ports.ts` et `index.ts` fondent à chaque extraction ; l'état final est la
disparition de la nursery pour tout ce qui a un module.

## Ordre et dépendances

TS.1 → TS.2 → TS.3 (indépendant, peut se faire en parallèle) → TS.4 → TS.5.
TS.1 et TS.2 sont petits ; TS.5 est une série de PRs sur la durée, à
intercaler avec le travail produit (une extraction quand on touche la zone).

## Suivi

| Lot | Contenu | État |
| --- | --- | --- |
| TS.1 | Configs, CI, hooks, skills | ✅ #251 |
| TS.2 | purity / public-surface / docs specs + Result | ✅ #252 |
| TS.3 | Pratique ADR | ✅ #250 |
| TS.4 | Subpath testing + premier contrat | ✅ #254 |
| TS.5.1 | Mécanisme (placeholders Sheriff, ratchet, `modules:hint`) | ✅ #255 |
| TS.5.x | Extractions de modules (une PR chacune) | ⬜ |
