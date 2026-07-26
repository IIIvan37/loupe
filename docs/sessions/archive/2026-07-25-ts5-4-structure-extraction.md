# Session — 2026-07-25 — ts5-4-structure-extraction

## Done

- **TS.5.4 — extraction du module `structure`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) :
  - **Promotion préalable : `nearest-time` → `shared/`** (second consommateur :
    `snap-loop-region`, à côté de `song-structure` — c'était l'une des trois
    promotions attendues du plan).
  - **`structure/domain/`** (3 fichiers + specs) : `song-structure`,
    `chart-structure`, `form-encoder`.
  - **`structure/application/`** : `detect-structure` (+ spec) **suit son
    module** — contrairement à `detect-chords`, il ne touche que
    song-structure + beat-grid ; son port `StructureDetector` déménage avec
    lui dans un `structure/application/ports.ts` dédié (le `ports.ts` nursery
    perd son unique référence à `DetectedSection`).
  - **depRule à deux arêtes** :
    `'feature:structure': [sameTag, 'shared', 'feature:harmony',
    'feature:rhythm']`. Preuve Mikado : Sheriff AVANT la ligne = exactement
    7 violations réparties sur ces deux seules arêtes ; APRÈS = vert.
  - `index.ts` : bloc `structure/` regroupé en fin de fichier (tri par
    chemin), aucune modification de la surface publique ; typecheck vert du
    premier coup après repointage.
- `pnpm modules:hint` : toujours aucun candidat par préfixe — le DAG du plan
  pilote les extractions restantes.
- Rotation sessions : `2026-07-24-ts3-pratique-adr.md` → `archive/`.

## Not done / remaining

- Extractions suivantes (ordre DAG) : `loops` (loop-region, loop-library,
  snap-loop-region), `separation`, `project` ; promotion `timecode` encore en
  attente d'un second consommateur module.
- `detect-chords`, `bass-line`, `chart-structure`-adjacents décidés en ts.5.3
  restent en nursery (décisions inchangées).

## Decisions

- **Les deux arêtes du DAG sont réelles** : `chart-structure` lit la beat-grid
  directement (`measureIndexAt`, seeks de mesure), pas seulement via harmony —
  d'où `structure → rhythm` EN PLUS de `structure → harmony`. Toujours une
  ligne par arête, jamais de wildcard.
- **Un port déménage avec son unique consommateur** : `StructureDetector` vit
  désormais dans `structure/application/ports.ts`, pattern identique à
  `TempoDetector`/rhythm (ts.5.2).
- **`shared/result.ts` (template) : adoption au fil de l'eau confirmée**, en
  PR séparées des moves (la propreté Mikado tient aux renames purs). Priorité
  produit : convertir d'abord les trois use-cases à `error: string` brut
  (`load-track`, `export-stems`, `import-from-url`) vers des erreurs à code —
  c'est un sujet i18n, pas cosmétique.

## Gate status

- typecheck : ✅ (vert au premier passage post-repointage)
- tests (with coverage) : ✅ 162 fichiers, 2320 tests
- mutation (Stryker, local, `--force`, depuis la racine) : ✅ 93,38 %
  (seuil break 90) — `structure/` 88,89 % (identique à avant le move),
  `shared/nearest-time` 100 %
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; seul ajustement :
  `check:fix` pour l'ordre d'imports, la profondeur changeant la clé de tri)

## State to resume from

- **Single next action** : PR ts.5.4 ouverte → merge, puis **TS.5.5 —
  extraction `loops`** (`loop-region`, `loop-library`, `snap-loop-region`) :
  depRule attendue `feature:loops → feature:rhythm` (snap sur la grille) ;
  vérifier si un use-case/port loops existe à embarquer.
- Gotchas : Stryker **depuis la racine** (`pnpm exec stryker run --force`) ;
  après un `git mv` cross-boundary, lancer `pnpm check:fix` (biome re-trie les
  imports dont la profondeur a changé) ; les imports in-cluster survivent tels
  quels.
