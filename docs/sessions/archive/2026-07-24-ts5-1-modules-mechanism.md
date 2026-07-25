# Session — 2026-07-24 — ts5-1-modules-mechanism

## Done

- **TS.5.1 — mécanisme des modules émergents**
  ([ADR-0005](../adr/0005-modules-emergents.md)) câblé, adapté du template
  (adapter `web`, pas de `cli`) :
  - `sheriff.config.ts` réécrit en deux dimensions de tags :
    - `layer:*` (l'hexagone : domain ← application ← testing) ;
    - `feature:*` via **placeholders dormants**
      `packages/core/src/<feature>/{domain,application,testing}` — créer le
      dossier suffit, aucune édition de config ; une extraction = un `git mv`.
    - Nurseries taguées `nursery` + `layer:*` ; **ratchet** : `nursery` peut
      importer `feature:*`, jamais l'inverse.
    - Isolation des features : `'feature:*': [sameTag, 'shared']` — une vraie
      dépendance inter-features = une ligne explicite de depRule, visible en
      revue.
    - Module `shared` (kernel) déclaré dormant — le dossier n'existe pas
      encore ; il naîtra par promotion (median, nearest-time, timecode
      attendus).
  - `scripts/modules-hint.ts` (repris du template, régex d'imports compatible
    `.ts`-extension) + script racine `pnpm modules:hint` — indice, jamais
    verdict.
- **Garde-fous prouvés par injection** (puis revert) : fausse feature `probe`
  raccordée au graphe via `index.ts` important la nursery → Sheriff rouge
  `feature:probe → nursery, layer:domain` (ratchet) ; `probe2` important
  `probe` → rouge `feature:probe2 → feature:probe` (isolation).
- **Premier run de `modules:hint` sur la vraie nursery** : `chord-*` ×5 en
  domain (cohésion 6 internes / 1 externe — le candidat `harmony` du plan) ;
  `detect-*` ×3 en application (cohésion 0/6 — préfixe partagé sans module :
  des use-cases transverses, l'illustration même de « indice ≠ verdict »).
- Rotation sessions : `2026-07-24-ap-close-guard-review.md` → `archive/`
  (borne ≤ 5 actifs).

## Not done / remaining

- Les extractions elles-mêmes (TS.5.x, une PR chacune, ordre DAG :
  `rhythm` → `harmony` → `structure` → `loops` → `separation` → `project`),
  à intercaler avec le travail produit.
- `loop-*` échappe à l'heuristique de préfixe (`snap-loop-region` commence par
  `snap`) — le plan reste la référence des candidats, l'outil un indice.

## Decisions

- Config Sheriff alignée sur le template à une exception : `web` ne reçoit
  **pas** `core:testing` (le template l'accorde à `cli`) — les specs sont
  invisibles pour Sheriff et l'interdiction en prod est l'override Biome ;
  l'accorder serait un droit mort. Prouvé suffisant par ts.4.
- `detect-*` n'est **pas** un module malgré la règle de trois : cohésion
  interne nulle, ce sont des use-cases qui traverseront les futures features
  (cf. ADR-0005, composition déclarée).

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 162 fichiers, 2314 tests
- mutation (Stryker) : **non relancé** — aucun fichier de `packages/core/src`
  dans le diff (config + script racine uniquement) ; score inchangé de ts.4
  (92,70 %).
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; ratchet et
  isolation vérifiés par injection)

## State to resume from

- **Single next action** : ouvrir la PR TS.5.1, puis **TS.5.2 — première
  extraction : `rhythm`** (beat-grid, manual-tempo, metronome, nudge-time,
  fine-tune…) : `git mv` de la tranche verticale dans
  `core/src/rhythm/{domain,application}`, laisser la gate énumérer la
  frontière, procédure Mikado (> ~2 niveaux de prérequis → revert, extraire
  les prérequis d'abord). Attendu : promotions `shared/` (median,
  nearest-time, timecode) et sortie des ports rhythm de `ports.ts` avec leurs
  contrats/fakes (ADR-0002).
- Gotchas : Sheriff ne voit que ce qui est atteignable depuis les entry points
  (`web`, `core-testing`) — un module orphelin du graphe n'est pas vérifié ;
  les placeholders sont dormants, ne pas ajouter de depRule tant qu'une vraie
  dépendance inter-features n'existe pas.
